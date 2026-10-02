import { AppDatabase } from './db';
import { 
  MasterSheetTabName, 
  SheetValidationError, 
  HierarchicalValidationReport, 
  SyncPreviewTabDiff, 
  SyncPreviewDiffItem,
  MultiTabSyncReport, 
  SyncDetailedReport,
  User, 
  Product, 
  Destination, 
  MasterRegion, 
  CityHub, 
  Hotel, 
  HotelRoomType, 
  HotelRate, 
  VisaProduct, 
  B2BPackage, 
  TransferRoute, 
  TransferRate, 
  ProductPricingRate, 
  ProductCapacityItem, 
  HotelMealPlanItem, 
  VisaRateItem, 
  PackageItemRef,
  CurrencyCode,
  MealPlanCode,
  TravelProtectionPlan,
  VipGroundService,
  ConnectivityPlan,
  DynamicModulePresetId,
  DynamicWorkbookInspectionReport
} from '../types';
import { 
  RailStation, 
  RailService, 
  RailRoute, 
  RailFare, 
  RailRate, 
  RailSeasonCalendarPeriod 
} from '../types/rail';
import { 
  MASTER_SHEETS_TAB_DEFINITIONS, 
  getTabSchemaByName,
  EXPECTED_MASTER_TAB_COUNT,
  MASTER_WORKBOOK_TABS
} from '../data/googleSheetsTemplate';
import { DESTINATIONS } from '../data/destinations';
import { 
  createDefaultRequirementsForVisa, 
  createDefaultAssistanceServices 
} from './visaRequirementService';
import {
  resolveAuthoritativeCategory,
  buildMasterProductConfiguration,
  ensureMasterProductConfiguration
} from './configuratorRegistry';
import { CurrencyEngine } from './currencyEngine';
import { MasterDataService } from './masterDataService';
import { CanonicalSchemaRegistry, CanonicalModuleSchema } from './canonicalSchemaRegistry';
import { ModulePresetRegistry, ModulePresetDefinition } from './modulePresetRegistry';
import { countingEngine } from './countingEngine';

export interface RawMultiTabData {
  [tabName: string]: string[][] | Record<string, any>[];
}

export class SheetsSyncService {
  private static instance: SheetsSyncService;

  private constructor() {}

  public static getInstance(): SheetsSyncService {
    if (!SheetsSyncService.instance) {
      SheetsSyncService.instance = new SheetsSyncService();
    }
    return SheetsSyncService.instance;
  }

  // ----------------------------------------------------
  // 1. CSV & SPREADSHEET PARSER UTILITIES
  // ----------------------------------------------------
  public parseCsvToRows(csvText: string): string[][] {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    const rows: string[][] = [];
    
    for (const line of lines) {
      // Regex handling quoted commas
      const row: string[] = [];
      let inQuotes = false;
      let curVal = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(curVal.trim().replace(/^["']|["']$/g, ''));
          curVal = '';
        } else {
          curVal += char;
        }
      }
      row.push(curVal.trim().replace(/^["']|["']$/g, ''));
      rows.push(row);
    }
    
    return rows;
  }

  public rowsToObjects(rows: string[][]): Record<string, any>[] {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
    const objects: Record<string, any>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) continue;
      const obj: Record<string, any> = { _rowIndex: i + 1 };
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (header) {
          obj[header] = row[j] !== undefined ? row[j].trim() : '';
        }
      }
      objects.push(obj);
    }
    return objects;
  }

  // ----------------------------------------------------
  // 2. REMOTE GOOGLE SPREADSHEET FETCHING
  // ----------------------------------------------------
  public async fetchRemoteWorksheet(sheetId: string, tabName: string): Promise<string[][] | null> {
    const cleanSheetId = sheetId.trim();
    const cleanTabName = tabName.trim();
    if (!cleanSheetId) return null;

    // 1. Primary: Use secure server-side proxy with automatic token refresh
    try {
      const storedToken = typeof window !== 'undefined' 
        ? (sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token'))
        : null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const serverRes = await fetch('/api/integrations/sheets/fetch-tab', {
        method: 'POST',
        headers,
        body: JSON.stringify({ spreadsheetId: cleanSheetId, tabName: cleanTabName })
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
          return data.rows;
        }
      }
    } catch (e) {
      // Continue to next fetch method
    }

    // 2. Secondary fallback: Direct Google Sheets v4 API with client Bearer Token
    const storedToken = typeof window !== 'undefined' 
      ? (sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token'))
      : null;

    if (storedToken && !cleanSheetId.includes(' ')) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSheetId}/values/${encodeURIComponent(cleanTabName)}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.values && Array.isArray(json.values) && json.values.length > 0) {
            return json.values;
          }
        }
      } catch (e) {
        // fallback
      }
    }

    // 3. Fallback: Google Sheets public CSV export endpoint
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(cleanTabName)}`;
      const res = await fetch(csvUrl);
      if (res.ok) {
        const csvText = await res.text();
        const rows = this.parseCsvToRows(csvText);
        if (rows.length > 1) {
          return rows;
        }
      }
    } catch (e) {
      // fallback
    }

    return null;
  }

  // ----------------------------------------------------
  // 3. MASTER WORKBOOK STRUCTURE & 25-TAB VALIDATION
  // ----------------------------------------------------
  /**
   * Validates the configured Master Workbook against the canonical 25-tab configuration.
   * Enforces exact tab count validation and canonical tab name/schema alignment.
   */
  public validateWorkbookStructure(discoveredTabNames: string[]): {
    isValid: boolean;
    expectedCount: number;
    foundCount: number;
    missingTabs: MasterSheetTabName[];
    unexpectedTabs: string[];
    canonicalTabs: MasterSheetTabName[];
    errorMessage?: string;
  } {
    const canonicalSet = new Set<string>(MASTER_WORKBOOK_TABS);
    
    // Normalize discovered tab names against schema aliases
    const normalizedDiscovered = discoveredTabNames
      .filter(t => Boolean(t))
      .map(name => {
        const def = getTabSchemaByName(name);
        return def ? def.tabName : name.trim();
      });

    const discoveredSet = new Set<string>(normalizedDiscovered);
    const missingTabs = MASTER_WORKBOOK_TABS.filter(t => !discoveredSet.has(t));
    const unexpectedTabs = normalizedDiscovered.filter(t => !canonicalSet.has(t as MasterSheetTabName));

    const isValid = missingTabs.length === 0 && discoveredSet.size === EXPECTED_MASTER_TAB_COUNT;

    let errorMessage: string | undefined;
    if (!isValid) {
      if (discoveredSet.size !== EXPECTED_MASTER_TAB_COUNT) {
        errorMessage = `Master Workbook Schema Error: Expected ${EXPECTED_MASTER_TAB_COUNT} canonical tabs, found ${discoveredSet.size} tabs. Missing: [${missingTabs.join(', ')}].`;
      } else if (missingTabs.length > 0) {
        errorMessage = `Master Workbook Schema Error: Expected ${EXPECTED_MASTER_TAB_COUNT} canonical tabs, found ${discoveredSet.size} tabs. Schema mismatch detected: Missing [${missingTabs.join(', ')}], Unexpected [${unexpectedTabs.join(', ')}].`;
      }
    }

    return {
      isValid,
      expectedCount: EXPECTED_MASTER_TAB_COUNT,
      foundCount: discoveredSet.size,
      missingTabs,
      unexpectedTabs,
      canonicalTabs: MASTER_WORKBOOK_TABS,
      errorMessage
    };
  }

  // ----------------------------------------------------
  // 4. HIERARCHICAL VALIDATION ENGINE
  // ----------------------------------------------------
  public validateHierarchicalData(multiTabData: RawMultiTabData): HierarchicalValidationReport {
    const db = AppDatabase.getInstance();
    const errors: SheetValidationError[] = [];
    const tabSummaries: Record<string, any> = {};

    // Standardize inputs to object arrays
    const parsedTabs: Record<string, Record<string, any>[]> = {};
    for (const [rawTabName, data] of Object.entries(multiTabData)) {
      const tabDef = getTabSchemaByName(rawTabName);
      const standardName = tabDef ? tabDef.tabName : rawTabName.toUpperCase();
      
      if (Array.isArray(data) && data.length > 0) {
        if (Array.isArray(data[0])) {
          parsedTabs[standardName] = this.rowsToObjects(data as string[][]);
        } else {
          parsedTabs[standardName] = data as Record<string, any>[];
        }
      } else {
        parsedTabs[standardName] = [];
      }
    }

    // Existing Database state for FK lookup
    const existingRegions = new Set(db.getMasterRegions().map(r => r.id));
    const existingDestinations = new Set(db.getDestinations().map(d => d.id));
    const existingHubs = new Set(db.getCityHubs().map(h => h.id));
    const existingProducts = new Set(db.getProducts().map(p => p.id || p.sku));
    const existingHotels = new Set(db.getHotels().map(h => h.id));
    const existingVisas = new Set(db.getVisas().map(v => v.id));
    const existingRoutes = new Set(db.getTransferRoutes().map(r => r.id));
    const existingPackages = new Set(db.getB2BPackages().map(p => p.id));
    const existingRooms = new Set(db.getHotelRooms().map(r => r.id));
    const existingMealPlans = new Set(db.getHotelMealPlans().map(m => m.id));
    const existingRailStations = new Set(db.getRailStations().map(s => s.stationId || (s as any).id));
    const existingRailRoutes = new Set(db.getRailRoutes().map(r => r.routeId || (r as any).id));
    const existingProtections = new Set(db.getTravelProtectionPlans().map(p => p.id));
    const existingVip = new Set(db.getVipGroundServices().map(v => v.id));
    const existingConn = new Set(db.getConnectivityPlans().map(c => c.id));

    // Also collect newly declared IDs in current sheet payload
    const incomingRegions = new Set((parsedTabs['REGIONS'] || []).map(r => r.region_id || r.id).filter(Boolean));
    const incomingDestinations = new Set((parsedTabs['DESTINATIONS'] || []).map(d => d.destination_id || d.id).filter(Boolean));
    const incomingHubs = new Set((parsedTabs['HUBS'] || []).map(h => h.hub_id || h.id).filter(Boolean));

    // Also collect from MASTER_DATA tab
    for (const r of (parsedTabs['MASTER_DATA'] || [])) {
      const type = (r.entity_type || r.type || '').toString().toLowerCase();
      const id = r.entity_id || r.code || r.id;
      if (!id) continue;
      if (type === 'region') incomingRegions.add(id);
      if (type === 'destination') incomingDestinations.add(id);
      if (type === 'hub') incomingHubs.add(id);
    }
    const incomingProducts = new Set((parsedTabs['PRODUCTS'] || []).map(p => p.product_id || p.sku || p.id).filter(Boolean));
    const incomingHotels = new Set((parsedTabs['HOTELS'] || []).map(h => h.hotel_id || h.id).filter(Boolean));
    const incomingVisas = new Set((parsedTabs['VISA'] || []).map(v => v.visa_id || v.id).filter(Boolean));
    const incomingRoutes = new Set((parsedTabs['TRANSFER_ROUTES'] || []).map(r => r.route_id || r.id).filter(Boolean));
    const incomingRooms = new Set((parsedTabs['HOTEL_ROOMS'] || []).map(r => r.room_id || r.id).filter(Boolean));
    const incomingMealPlans = new Set((parsedTabs['HOTEL_MEAL_PLANS'] || []).map(m => m.meal_plan_id || m.id).filter(Boolean));
    const incomingRailStations = new Set((parsedTabs['RAIL_STATIONS'] || []).map(s => s.station_id || s.id).filter(Boolean));
    const incomingRailRoutes = new Set((parsedTabs['RAIL_ROUTES'] || []).map(r => r.route_id || r.id).filter(Boolean));
    const incomingProtections = new Set((parsedTabs['TRAVEL_PROTECTION'] || []).map(p => p.protection_id || p.id).filter(Boolean));
    const incomingVip = new Set((parsedTabs['VIP_GROUND'] || []).map(v => v.vip_id || v.id).filter(Boolean));
    const incomingConn = new Set((parsedTabs['CONNECTIVITY'] || []).map(c => c.connectivity_id || c.id).filter(Boolean));

    const templateDestDef = getTabSchemaByName('DESTINATIONS');
    const templateDestIds = templateDestDef ? templateDestDef.sampleRows.map(r => r[0]) : [];
    const templateHubDef = getTabSchemaByName('HUBS');
    const templateHubIds = templateHubDef ? templateHubDef.sampleRows.map(r => r[0]) : [];
    const canonicalDestIds = DESTINATIONS.map(d => d.id);
    const canonicalDestSlugs = DESTINATIONS.map(d => d.slug);

    const validRegionIds = new Set([
      ...existingRegions, 
      ...incomingRegions, 
      'REG-001', 'REG-002', 'REG-003', 'REG-004', 'reg-east-asia', 'reg-europe', 'reg-middle-east', 'reg-southeast-asia'
    ]);
    const validDestIds = new Set([
      ...existingDestinations, 
      ...incomingDestinations, 
      ...templateDestIds, 
      ...canonicalDestIds, 
      ...canonicalDestSlugs,
      'dest-japan', 'dest-uk', 'dest-europe', 'dest-dubai', 'dest-thailand', 'dest-singapore', 'dest-malaysia', 'dest-bali', 'dest-vietnam',
      'DST-JPN', 'DST-UK', 'DST-FRA', 'DST-UAE', 'DST-THA', 'worldwide', 'Worldwide'
    ]);
    const validHubIds = new Set([
      ...existingHubs, 
      ...incomingHubs, 
      ...templateHubIds,
      'hub-tokyo', 'hub-kyoto', 'hub-osaka', 'hub-london', 'hub-dubai', 'hub-bangkok',
      'HUB-TYO', 'HUB-KYO', 'HUB-LON', 'HUB-DXB', 'HUB-BKK'
    ]);
    const validProductIds = new Set([...existingProducts, ...incomingProducts]);
    const validHotelIds = new Set([...existingHotels, ...incomingHotels]);
    const validVisaIds = new Set([...existingVisas, ...incomingVisas]);
    const validRouteIds = new Set([...existingRoutes, ...incomingRoutes]);
    const validRoomIds = new Set([...existingRooms, ...incomingRooms]);
    const validMealPlanIds = new Set([...existingMealPlans, ...incomingMealPlans]);
    const validRailStationIds = new Set([...existingRailStations, ...incomingRailStations]);
    const validRailRouteIds = new Set([...existingRailRoutes, ...incomingRailRoutes]);
    const validProtectionIds = new Set([...existingProtections, ...incomingProtections]);
    const validVipIds = new Set([...existingVip, ...incomingVip]);
    const validConnIds = new Set([...existingConn, ...incomingConn]);

    let orphanDestinations = 0;
    let orphanHubs = 0;
    let orphanProducts = 0;
    let orphanHotels = 0;
    let orphanTransfers = 0;
    let orphanPackages = 0;
    let rateMismatches = 0;
    let orphanRailStations = 0;
    let orphanRailRoutes = 0;
    let orphanRailFares = 0;

    let totalRowsCount = 0;
    let validRowsCount = 0;

    // Validate each sheet
    for (const schema of MASTER_SHEETS_TAB_DEFINITIONS) {
      if (schema.tabName === 'INSTRUCTIONS') continue;
      const tabKey = schema.tabName;
      const rows = parsedTabs[tabKey] || [];
      totalRowsCount += rows.length;
      let tabErrors = 0;
      let tabWarnings = 0;

      const seenIds = new Set<string>();

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNum = row._rowIndex || (idx + 2);
        let rowHasCritical = false;

        // 1. Check Primary Key
        const pkField = (schema.primaryKey || 'id').toLowerCase();
        const pkVal = (row[pkField] || row.id || row.sku || '').trim();

        if (!pkVal) {
          errors.push({
            tabName: tabKey,
            rowNumber: rowNum,
            recordId: 'MISSING_ID',
            field: schema.primaryKey,
            value: '',
            error: `Primary Key '${schema.primaryKey}' is required and cannot be empty.`,
            severity: 'CRITICAL',
            suggestedFix: `Assign a permanent stable ID such as ${schema.columns[0]?.sampleValue || 'ID-001'}`
          });
          tabErrors++;
          rowHasCritical = true;
        } else if (seenIds.has(pkVal)) {
          errors.push({
            tabName: tabKey,
            rowNumber: rowNum,
            recordId: pkVal,
            field: schema.primaryKey,
            value: pkVal,
            error: `Duplicate Primary Key '${pkVal}' found in ${tabKey} sheet.`,
            severity: 'CRITICAL',
            suggestedFix: `Ensure every record has a unique ID.`
          });
          tabErrors++;
          rowHasCritical = true;
        } else {
          seenIds.add(pkVal);
        }

        // 2. Validate Foreign Keys & Hierarchical relationships
        if (tabKey === 'DESTINATIONS') {
          const regionId = (row.region_id || '').trim();
          if (!regionId) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'region_id',
              value: '',
              error: `Missing parent region_id for Destination '${row.destination_name || pkVal}'.`,
              severity: 'CRITICAL',
              suggestedFix: `Specify a valid parent region_id (e.g. REG-001) from the REGIONS tab.`
            });
            orphanDestinations++;
            tabErrors++;
            rowHasCritical = true;
          } else if (!validRegionIds.has(regionId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'region_id',
              value: regionId,
              error: `Orphan Destination: Parent region_id '${regionId}' does not exist in REGIONS tab or database.`,
              severity: 'CRITICAL',
              suggestedFix: `Define Region '${regionId}' in the REGIONS tab first.`
            });
            orphanDestinations++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'HUBS') {
          const destId = (row.destination_id || '').trim();
          if (!destId || !validDestIds.has(destId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'destination_id',
              value: destId,
              error: `Orphan City Hub: Parent destination_id '${destId}' not found in DESTINATIONS tab or database.`,
              severity: 'CRITICAL',
              suggestedFix: `Link to an existing destination_id (e.g. DST-JPN).`
            });
            orphanHubs++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'PRODUCTS') {
          const hubId = (row.hub_id || '').trim();
          const destId = (row.destination_id || '').trim();
          if (hubId && !validHubIds.has(hubId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'hub_id',
              value: hubId,
              error: `Invalid hub_id '${hubId}'. Hub does not exist in HUBS tab or database.`,
              severity: 'CRITICAL',
              suggestedFix: `Define Hub '${hubId}' in HUBS tab or use an existing Hub ID.`
            });
            orphanProducts++;
            tabErrors++;
            rowHasCritical = true;
          }
          if (destId && !validDestIds.has(destId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'destination_id',
              value: destId,
              error: `Invalid destination_id '${destId}' for Product '${row.product_name || pkVal}'.`,
              severity: 'CRITICAL',
              suggestedFix: `Check destination_id in DESTINATIONS tab.`
            });
            orphanProducts++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'HOTELS') {
          const hubId = (row.hub_id || '').trim();
          if (hubId && !validHubIds.has(hubId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'hub_id',
              value: hubId,
              error: `Orphan Hotel: hub_id '${hubId}' not found in HUBS tab.`,
              severity: 'CRITICAL',
              suggestedFix: `Link to a valid City Hub ID.`
            });
            orphanHotels++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'TRANSFER_ROUTES') {
          const fromHub = (row.from_hub_id || '').trim();
          const toHub = (row.to_hub_id || '').trim();
          if (fromHub && !validHubIds.has(fromHub)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'from_hub_id',
              value: fromHub,
              error: `Transfer starting from_hub_id '${fromHub}' does not exist.`,
              severity: 'CRITICAL',
              suggestedFix: `Ensure starting hub exists in HUBS tab.`
            });
            orphanTransfers++;
            tabErrors++;
            rowHasCritical = true;
          }
          if (toHub && !validHubIds.has(toHub)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'to_hub_id',
              value: toHub,
              error: `Transfer destination to_hub_id '${toHub}' does not exist.`,
              severity: 'CRITICAL',
              suggestedFix: `Ensure arrival hub exists in HUBS tab.`
            });
            orphanTransfers++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'PRODUCT_PRICING') {
          const prdId = (row.product_id || '').trim();
          if (!prdId || !validProductIds.has(prdId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'product_id',
              value: prdId,
              error: `Rate Mismatch: product_id '${prdId}' does not match any Product in PRODUCTS tab or database.`,
              severity: 'CRITICAL',
              suggestedFix: `Ensure product_id exists in the PRODUCTS tab.`
            });
            rateMismatches++;
            tabErrors++;
            rowHasCritical = true;
          }

          const adultNett = Number(row.adult_nett);
          if (isNaN(adultNett) || adultNett < 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'adult_nett',
              value: String(row.adult_nett),
              error: `adult_nett must be a valid positive number.`,
              severity: 'CRITICAL',
              suggestedFix: `Enter numeric amount (e.g. 42000).`
            });
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'HOTEL_RATES') {
          const htlId = (row.hotel_id || '').trim();
          const roomId = (row.room_id || '').trim();
          if (htlId && !validHotelIds.has(htlId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'hotel_id',
              value: htlId,
              error: `hotel_id '${htlId}' does not exist in HOTELS tab.`,
              severity: 'CRITICAL',
              suggestedFix: `Match with hotel_id in HOTELS tab.`
            });
            rateMismatches++;
            tabErrors++;
            rowHasCritical = true;
          }
          if (roomId && !validRoomIds.has(roomId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'room_id',
              value: roomId,
              error: `room_id '${roomId}' does not exist in HOTEL_ROOMS tab.`,
              severity: 'CRITICAL',
              suggestedFix: `Match with room_id in HOTEL_ROOMS tab.`
            });
            rateMismatches++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'TRAVEL_PROTECTION') {
          const destId = (row.destination_id || '').trim();
          if (destId && !validDestIds.has(destId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'destination_id',
              value: destId,
              error: `Invalid destination_id '${destId}' for Travel Protection plan '${row.service_name || pkVal}'.`,
              severity: 'WARNING',
              suggestedFix: `Check destination_id in DESTINATIONS tab or leave blank for worldwide plans.`
            });
            tabWarnings++;
          }
          const netTrip = Number(row.net_cost_per_trip);
          if (isNaN(netTrip) || netTrip < 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'net_cost_per_trip',
              value: String(row.net_cost_per_trip),
              error: `net_cost_per_trip must be a valid positive number.`,
              severity: 'CRITICAL',
              suggestedFix: `Provide net cost per trip (e.g. 35).`
            });
            tabErrors++;
            rowHasCritical = true;
          }
          const sellTrip = Number(row.selling_price_per_trip);
          if (isNaN(sellTrip) || sellTrip < 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'selling_price_per_trip',
              value: String(row.selling_price_per_trip),
              error: `selling_price_per_trip must be a valid positive number.`,
              severity: 'CRITICAL',
              suggestedFix: `Provide selling price per trip (e.g. 55).`
            });
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'VIP_GROUND') {
          const destId = (row.destination_id || '').trim();
          const hubId = (row.hub_id || '').trim();
          if (destId && !validDestIds.has(destId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'destination_id',
              value: destId,
              error: `destination_id '${destId}' does not exist for VIP service '${row.name || pkVal}'.`,
              severity: 'CRITICAL',
              suggestedFix: `Match with destination_id in DESTINATIONS tab.`
            });
            tabErrors++;
            rowHasCritical = true;
          }
          if (hubId && !validHubIds.has(hubId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'hub_id',
              value: hubId,
              error: `hub_id '${hubId}' does not exist in HUBS tab.`,
              severity: 'WARNING',
              suggestedFix: `Match with hub_id in HUBS tab.`
            });
            tabWarnings++;
          }
          const netCost = Number(row.net_cost);
          if (isNaN(netCost) || netCost < 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'net_cost',
              value: String(row.net_cost),
              error: `net_cost must be a valid positive number.`,
              severity: 'CRITICAL',
              suggestedFix: `Provide valid net cost (e.g. 140).`
            });
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'CONNECTIVITY') {
          const netCost = Number(row.net_cost);
          if (isNaN(netCost) || netCost < 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'net_cost',
              value: String(row.net_cost),
              error: `net_cost must be a valid positive number.`,
              severity: 'CRITICAL',
              suggestedFix: `Provide valid net cost (e.g. 12).`
            });
            tabErrors++;
            rowHasCritical = true;
          }
          const sellPrice = Number(row.selling_price);
          if (isNaN(sellPrice) || sellPrice < 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'selling_price',
              value: String(row.selling_price),
              error: `selling_price must be a valid positive number.`,
              severity: 'CRITICAL',
              suggestedFix: `Provide valid selling price (e.g. 18).`
            });
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'RAIL_STATIONS') {
          const regionId = (row.region_id || '').trim();
          const destId = (row.destination_id || '').trim();
          if (regionId && !validRegionIds.has(regionId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'region_id',
              value: regionId,
              error: `Invalid region_id '${regionId}' for Rail Station '${row.station_name || pkVal}'.`,
              severity: 'CRITICAL',
              suggestedFix: `Check region_id in REGIONS tab.`
            });
            orphanRailStations++;
            tabErrors++;
            rowHasCritical = true;
          }
          if (destId && !validDestIds.has(destId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'destination_id',
              value: destId,
              error: `Invalid destination_id '${destId}' for Rail Station '${row.station_name || pkVal}'.`,
              severity: 'CRITICAL',
              suggestedFix: `Check destination_id in DESTINATIONS tab.`
            });
            orphanRailStations++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'RAIL_ROUTES') {
          const originId = (row.origin_station_id || '').trim();
          const destId = (row.destination_station_id || '').trim();
          if (originId && !validRailStationIds.has(originId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'origin_station_id',
              value: originId,
              error: `Origin station '${originId}' does not exist in RAIL_STATIONS tab or database.`,
              severity: 'CRITICAL',
              suggestedFix: `Ensure origin_station_id exists in RAIL_STATIONS tab.`
            });
            orphanRailRoutes++;
            tabErrors++;
            rowHasCritical = true;
          }
          if (destId && !validRailStationIds.has(destId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'destination_station_id',
              value: destId,
              error: `Destination station '${destId}' does not exist in RAIL_STATIONS tab or database.`,
              severity: 'CRITICAL',
              suggestedFix: `Ensure destination_station_id exists in RAIL_STATIONS tab.`
            });
            orphanRailRoutes++;
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'RAIL_SERVICES') {
          const originId = (row.origin_station_id || '').trim();
          const destId = (row.destination_station_id || '').trim();
          if (originId && !validRailStationIds.has(originId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'origin_station_id',
              value: originId,
              error: `Service origin station '${originId}' not found in RAIL_STATIONS tab.`,
              severity: 'CRITICAL',
              suggestedFix: `Ensure origin_station_id exists in RAIL_STATIONS tab.`
            });
            tabErrors++;
            rowHasCritical = true;
          }
          if (destId && !validRailStationIds.has(destId)) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'destination_station_id',
              value: destId,
              error: `Service destination station '${destId}' not found in RAIL_STATIONS tab.`,
              severity: 'CRITICAL',
              suggestedFix: `Ensure destination_station_id exists in RAIL_STATIONS tab.`
            });
            tabErrors++;
            rowHasCritical = true;
          }
        } else if (tabKey === 'RAIL_FARES') {
          const nettPrice = Number(row.nett_price);
          const finalPrice = Number(row.final_price);

          if (isNaN(nettPrice) || nettPrice < 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'nett_price',
              value: String(row.nett_price),
              error: `nett_price must be a valid non-negative number in JPY.`,
              severity: 'CRITICAL',
              suggestedFix: `Provide valid supplier cost in JPY (e.g. 13320).`
            });
            tabErrors++;
            rowHasCritical = true;
          } else if (nettPrice === 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'nett_price',
              value: '0',
              error: `Zero-Price Warning: nett_price is 0 for fare '${pkVal}'. Verify supplier cost.`,
              severity: 'WARNING',
              suggestedFix: `Ensure tariff is non-zero unless intentionally complimentary.`
            });
            tabWarnings++;
          }

          if (isNaN(finalPrice) || finalPrice <= 0) {
            errors.push({
              tabName: tabKey,
              rowNumber: rowNum,
              recordId: pkVal,
              field: 'final_price',
              value: String(row.final_price),
              error: `final_price must be a valid positive selling price.`,
              severity: 'CRITICAL',
              suggestedFix: `Calculate final_price as Nett + Margin + Tax + Service Charge.`
            });
            tabErrors++;
            rowHasCritical = true;
          }
        }

        // 3. Validate Date formats (ISO YYYY-MM-DD)
        if (row.validity_from && !/^\d{4}-\d{2}-\d{2}$/.test(row.validity_from)) {
          errors.push({
            tabName: tabKey,
            rowNumber: rowNum,
            recordId: pkVal,
            field: 'validity_from',
            value: row.validity_from,
            error: `Date format must be YYYY-MM-DD (e.g. 2026-01-01).`,
            severity: 'WARNING',
            suggestedFix: `Format as YYYY-MM-DD`
          });
          tabWarnings++;
        }

        if (row.validity_to && !/^\d{4}-\d{2}-\d{2}$/.test(row.validity_to)) {
          errors.push({
            tabName: tabKey,
            rowNumber: rowNum,
            recordId: pkVal,
            field: 'validity_to',
            value: row.validity_to,
            error: `Date format must be YYYY-MM-DD (e.g. 2026-12-31).`,
            severity: 'WARNING',
            suggestedFix: `Format as YYYY-MM-DD`
          });
          tabWarnings++;
        }

        if (!rowHasCritical) {
          validRowsCount++;
        }
      }

      tabSummaries[tabKey] = {
        tabName: tabKey,
        totalRows: rows.length,
        validRows: Math.max(0, rows.length - tabErrors),
        errorRows: tabErrors,
        warningRows: tabWarnings,
        status: tabErrors > 0 ? 'ERROR' : (tabWarnings > 0 ? 'WARNING' : 'VALID')
      };
    }

    return {
      isValid: errors.filter(e => e.severity === 'CRITICAL').length === 0,
      totalRows: totalRowsCount,
      validRows: validRowsCount,
      errorRows: errors.filter(e => e.severity === 'CRITICAL').length,
      tabSummaries,
      errors,
      hierarchyHealth: {
        orphanDestinations,
        orphanHubs,
        orphanProducts,
        orphanHotels,
        orphanTransfers,
        orphanPackages,
        rateMismatches
      }
    };
  }

  // ----------------------------------------------------
  // 4. PREVIEW & DIFF CALCULATION ENGINE
  // ----------------------------------------------------
  public generateSyncPreview(
    multiTabData: RawMultiTabData,
    selectedTabs?: MasterSheetTabName[]
  ): Record<string, SyncPreviewTabDiff> {
    const db = AppDatabase.getInstance();
    const diffs: Record<string, SyncPreviewTabDiff> = {};

    const tabsToProcess = selectedTabs && selectedTabs.length > 0
      ? selectedTabs
      : (MASTER_SHEETS_TAB_DEFINITIONS.filter(t => t.tabName !== 'INSTRUCTIONS').map(t => t.tabName) as MasterSheetTabName[]);

    for (const tabKey of tabsToProcess) {
      const tabDef = getTabSchemaByName(tabKey);
      if (!tabDef) continue;

      let rawRows = multiTabData[tabKey] || multiTabData[tabDef.displayName] || [];
      let objects: Record<string, any>[] = [];

      if (Array.isArray(rawRows) && rawRows.length > 0) {
        if (Array.isArray(rawRows[0])) {
          objects = this.rowsToObjects(rawRows as string[][]);
        } else {
          objects = rawRows as Record<string, any>[];
        }
      }

      const diffItems: SyncPreviewDiffItem[] = [];
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let errorCount = 0;

      // Map against existing entities in DB
      let existingMap = new Map<string, any>();

      if (tabKey === 'MASTER_DATA') {
        db.getMasterRegions().forEach(r => existingMap.set(r.id, r));
        db.getDestinations().forEach(d => existingMap.set(d.id, d));
        db.getCityHubs().forEach(h => existingMap.set(h.id, h));
        db.getRailStations().forEach(s => existingMap.set(s.stationId || (s as any).id, s));
        db.getSuppliers().forEach(s => existingMap.set(s.id, s));
      } else if (tabKey === 'VISA_ANCILLARY') {
        db.getVisas().forEach(v => existingMap.set(v.id, v));
        db.getTravelProtectionPlans().forEach(p => existingMap.set(p.id, p));
        db.getVipGroundServices().forEach(v => existingMap.set(v.id, v));
        db.getConnectivityPlans().forEach(c => existingMap.set(c.id, c));
      } else if (tabKey === 'RAIL') {
        db.getRailRoutes().forEach(r => existingMap.set(r.routeId || (r as any).id, r));
        db.getRailFares().forEach(f => existingMap.set(f.railFareId || (f as any).id, f));
      } else if (tabKey === 'REGIONS') {
        db.getMasterRegions().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'DESTINATIONS') {
        db.getDestinations().forEach(d => existingMap.set(d.id, d));
      } else if (tabKey === 'HUBS') {
        db.getCityHubs().forEach(h => existingMap.set(h.id, h));
      } else if (tabKey === 'PRODUCTS') {
        db.getProducts().forEach(p => {
          if (p.id) existingMap.set(p.id, p);
          if (p.sku) existingMap.set(p.sku, p);
        });
      } else if (tabKey === 'PRODUCT_PRICING') {
        db.getProductRates().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'PRODUCT_CAPACITY') {
        db.getProductCapacities().forEach(c => existingMap.set(c.id, c));
      } else if (tabKey === 'HOTELS') {
        db.getHotels().forEach(h => {
          if (h.id) existingMap.set(h.id, h);
          if (h.code) existingMap.set(h.code, h);
        });
      } else if (tabKey === 'HOTEL_ROOMS') {
        db.getHotelRooms().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'HOTEL_MEAL_PLANS') {
        db.getHotelMealPlans().forEach(m => existingMap.set(m.id, m));
      } else if (tabKey === 'HOTEL_RATES') {
        db.getHotelRates().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'VISA') {
        db.getVisas().forEach(v => existingMap.set(v.id, v));
      } else if (tabKey === 'VISA_RATES') {
        db.getVisaRates().forEach(vr => existingMap.set(vr.id, vr));
      } else if (tabKey === 'TRAVEL_PROTECTION') {
        db.getTravelProtectionPlans().forEach(p => existingMap.set(p.id, p));
      } else if (tabKey === 'VIP_GROUND') {
        db.getVipGroundServices().forEach(v => existingMap.set(v.id, v));
      } else if (tabKey === 'CONNECTIVITY') {
        db.getConnectivityPlans().forEach(c => existingMap.set(c.id, c));
      } else if (tabKey === 'TRANSFER_ROUTES') {
        db.getTransferRoutes().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'TRANSFER_RATES') {
        db.getTransferRates().forEach(tr => existingMap.set(tr.id, tr));
      } else if (tabKey === 'PACKAGES') {
        db.getB2BPackages().forEach(p => existingMap.set(p.id, p));
      } else if (tabKey === 'PACKAGE_ITEMS') {
        db.getPackageItems().forEach(pi => existingMap.set(pi.id, pi));
      } else if (tabKey === 'RAIL_STATIONS') {
        db.getRailStations().forEach(s => existingMap.set(s.stationId || (s as any).id, s));
      } else if (tabKey === 'RAIL_ROUTES') {
        db.getRailRoutes().forEach(r => existingMap.set(r.routeId || (r as any).id, r));
      } else if (tabKey === 'RAIL_SERVICES') {
        db.getRailServices().forEach(s => existingMap.set(s.serviceId || (s as any).id, s));
      } else if (tabKey === 'RAIL_FARES') {
        db.getRailFares().forEach(f => existingMap.set(f.railFareId || (f as any).id, f));
      } else if (tabKey === 'RAIL_CLASS_RULES') {
        db.getRailSeasons().forEach(s => existingMap.set(s.id, s));
      } else if (tabKey === 'FX_RATES') {
        CurrencyEngine.getInstance().getAllPairs().forEach(p => existingMap.set(p.id, p));
      }

      for (const row of objects) {
        const pkField = (tabDef.primaryKey || 'id').toLowerCase();
        const pkVal = (row[pkField] || row.id || row.sku || '').trim();

        if (!pkVal) {
          errorCount++;
          diffItems.push({
            id: `ROW_${row._rowIndex || '?' }`,
            tabName: tabKey,
            title: `Invalid Row (Missing Primary Key)`,
            action: 'BLOCKED',
            details: `Missing mandatory primary key '${tabDef.primaryKey}'`
          });
          continue;
        }

        const existing = existingMap.get(pkVal);
        if (!existing) {
          created++;
          diffItems.push({
            id: pkVal,
            tabName: tabKey,
            title: row.product_name || row.hotel_name || row.destination_name || row.region_name || row.route_name || row.package_name || pkVal,
            action: 'CREATE',
            details: `New entity to be inserted into database`,
            rawData: row
          });
        } else {
          // Compare field diffs
          const changedFields: string[] = [];
          for (const col of tabDef.columns) {
            const fieldKey = col.key.toLowerCase();
            const newVal = row[fieldKey];
            const oldVal = existing[col.key] || existing[fieldKey];
            if (newVal !== undefined && String(newVal) !== String(oldVal || '')) {
              changedFields.push(col.name);
            }
          }

          if (changedFields.length > 0) {
            updated++;
            diffItems.push({
              id: pkVal,
              tabName: tabKey,
              title: row.product_name || row.hotel_name || row.destination_name || existing.name || pkVal,
              action: 'UPDATE',
              changedFields,
              details: `Updates ${changedFields.length} field(s): ${changedFields.slice(0, 4).join(', ')}`,
              rawData: row
            });
          } else {
            unchanged++;
            diffItems.push({
              id: pkVal,
              tabName: tabKey,
              title: row.product_name || row.hotel_name || row.destination_name || existing.name || pkVal,
              action: 'UNCHANGED',
              details: `No changes detected against database`,
              rawData: row
            });
          }
        }
      }

      diffs[tabKey] = {
        tabName: tabKey,
        createdCount: created,
        updatedCount: updated,
        unchangedCount: unchanged,
        errorCount,
        items: diffItems
      };
    }

    return diffs;
  }

  // ----------------------------------------------------
  // 5. ATOMIC UPSERT & COMMIT ENGINE
  // ----------------------------------------------------
  public async commitMultiTabSync(
    multiTabData: RawMultiTabData,
    selectedTabs?: MasterSheetTabName[],
    user?: User | null,
    sheetId: string = 'MASTER_GOOGLE_SHEET'
  ): Promise<MultiTabSyncReport> {
    const startTime = Date.now();
    const db = AppDatabase.getInstance();
    const logs: string[] = [];

    logs.push(`[${new Date().toLocaleTimeString()}] Starting Multi-Tab Sync protocol...`);

    // 1. Validate first
    const validation = this.validateHierarchicalData(multiTabData);
    if (!validation.isValid) {
      logs.push(`[${new Date().toLocaleTimeString()}] Validation failed with ${validation.errorRows} critical errors.`);
    }

    // 2. Generate diffs
    const diffs = this.generateSyncPreview(multiTabData, selectedTabs);

    const tabsToProcess = selectedTabs && selectedTabs.length > 0
      ? selectedTabs
      : (MASTER_SHEETS_TAB_DEFINITIONS.filter(t => t.tabName !== 'INSTRUCTIONS').map(t => t.tabName) as MasterSheetTabName[]);

    // 3. Process in strict Top-Down Hierarchical Order
    const payload: {
      regions?: MasterRegion[];
      destinations?: Destination[];
      hubs?: CityHub[];
      products?: Product[];
      productRates?: ProductPricingRate[];
      productCapacities?: ProductCapacityItem[];
      hotels?: Hotel[];
      hotelRooms?: HotelRoomType[];
      hotelMealPlans?: HotelMealPlanItem[];
      hotelRates?: HotelRate[];
      visas?: VisaProduct[];
      visaRates?: VisaRateItem[];
      transferRoutes?: TransferRoute[];
      transferRates?: TransferRate[];
      packages?: B2BPackage[];
      packageItems?: PackageItemRef[];
      railStations?: RailStation[];
      railServices?: RailService[];
      railRoutes?: RailRoute[];
      railFares?: RailFare[];
      railRates?: RailRate[];
      railSeasons?: RailSeasonCalendarPeriod[];
      travelProtectionPlans?: TravelProtectionPlan[];
      vipGroundServices?: VipGroundService[];
      connectivityPlans?: ConnectivityPlan[];
    } = {};

    let createdTotal = 0;
    let updatedTotal = 0;
    let unchangedTotal = 0;
    let errorsTotal = 0;

    for (const tabKey of tabsToProcess) {
      const diff = diffs[tabKey];
      if (diff) {
        createdTotal += diff.createdCount;
        updatedTotal += diff.updatedCount;
        unchangedTotal += diff.unchangedCount;
        errorsTotal += diff.errorCount;
      }

      let rawRows = multiTabData[tabKey] || [];
      let objects: Record<string, any>[] = [];
      if (Array.isArray(rawRows) && rawRows.length > 0) {
        objects = Array.isArray(rawRows[0]) ? this.rowsToObjects(rawRows as string[][]) : rawRows as Record<string, any>[];
      }

      if (tabKey === 'MASTER_DATA') {
        const regions: MasterRegion[] = [];
        const destinations: Destination[] = [];
        const hubs: CityHub[] = [];
        const railStations: RailStation[] = [];
        const suppliers: any[] = [];

        for (const r of objects) {
          const type = (r.entity_type || r.type || '').toString().toLowerCase();
          const id = r.entity_id || r.code || r.id;
          if (!id) continue;

          if (type === 'region') {
            regions.push({
              id,
              name: r.name || 'Region',
              code: r.code || id.toUpperCase(),
              slug: (r.name || r.code || '').toLowerCase().replace(/\s+/g, '-'),
              currency: (r.currency || 'USD') as CurrencyCode,
              status: (r.status || 'ACTIVE').toUpperCase().includes('ACTIVE') ? 'ACTIVE' : 'INACTIVE',
              displayOrder: 1,
              description: r.description || '',
              heroImage: '',
              isPublished: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else if (type === 'destination') {
            destinations.push({
              id,
              regionId: r.parent_id || 'REG-001',
              name: r.name || 'Destination',
              country: r.country || r.name || '',
              slug: (r.name || r.code || '').toLowerCase().replace(/\s+/g, '-'),
              currency: (r.currency || 'USD') as CurrencyCode,
              status: (r.status || 'ACTIVE').toUpperCase().includes('COMING') ? 'COMING_SOON' : 'ACTIVE',
              heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
              description: r.description || '',
              region: r.parent_id || 'East Asia',
              tagline: `Premium Ground Logistics across ${r.name || 'the Destination'}`,
              keySellingPoints: ['Curated 5-Star Accommodations', 'Private Chauffeur Fleet', '24/7 Dedicated DMC Operations'],
              bestTimeToVisit: 'Year-Round / Seasonal',
              idealTripDuration: '7–14 Days',
              travelStyle: 'Bespoke Luxury & Cultural Immersion',
              cities: [],
              highlights: ['Exclusive Experiences', 'VIP Airport Fast Track'],
              featuredProductIds: []
            });
          } else if (type === 'hub') {
            hubs.push({
              id,
              destinationId: r.parent_id || 'DST-JPN',
              destinationName: r.country || 'Destination',
              regionId: 'REG-001',
              name: r.name || 'City Hub',
              tagline: 'City Gateway',
              description: r.description || `Operational logistics hub in ${r.name}.`,
              heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
              images: ['https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200'],
              displayOrder: 1,
              isPublished: true,
              status: (r.status || 'ACTIVE').toUpperCase().includes('ACTIVE') ? 'ACTIVE' : 'ARCHIVED',
              airportCode: '',
              railwayStation: '',
              productCount: 0,
              hotelCount: 0,
              highlights: []
            });
          } else if (type === 'station') {
            railStations.push({
              stationId: id,
              stationCode: r.code || id,
              stationName: r.name || 'Rail Station',
              stationNameLocal: '',
              displayName: r.name || 'Rail Station',
              searchAliases: [r.name || '', r.code || ''].filter(Boolean),
              country: r.country || 'Japan',
              regionId: 'reg-east-asia',
              destinationId: 'dest-japan',
              hubId: r.parent_id || 'hub-tokyo',
              city: r.country || 'Tokyo',
              railOperator: 'JR Central',
              latitude: 35.6812,
              longitude: 139.7671,
              timezone: 'Asia/Tokyo',
              shinkansenLine: 'Tokaido Shinkansen',
              isMajorHub: false,
              active: (r.status || 'ACTIVE').toUpperCase().includes('ACTIVE'),
              status: (r.status || 'ACTIVE').toUpperCase().includes('ACTIVE') ? 'ACTIVE' : 'INACTIVE',
              displayOrder: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else if (type === 'supplier') {
            suppliers.push({
              id,
              name: r.name || 'Supplier',
              code: r.code || id,
              destinationId: r.parent_id || 'DST-JPN',
              country: r.country || 'Japan',
              currency: (r.currency || 'JPY') as CurrencyCode,
              status: (r.status || 'ACTIVE').toUpperCase().includes('ACTIVE') ? 'ACTIVE' : 'INACTIVE',
              description: r.description || ''
            });
          }
        }

        if (regions.length > 0) payload.regions = regions;
        if (destinations.length > 0) payload.destinations = destinations;
        if (hubs.length > 0) payload.hubs = hubs;
        if (railStations.length > 0) payload.railStations = railStations;
        if (suppliers.length > 0) (payload as any).suppliers = suppliers;
        logs.push(`[${new Date().toLocaleTimeString()}] Staged Master Data (${regions.length} Regions, ${destinations.length} Destinations, ${hubs.length} Hubs, ${railStations.length} Stations, ${suppliers.length} Suppliers).`);
      } else if (tabKey === 'REGIONS') {
        payload.regions = objects.map(r => ({
          id: r.region_id || r.id,
          name: r.region_name || r.name || 'Region',
          code: r.code || r.region_code || (r.id || 'REG').toUpperCase(),
          slug: r.slug || (r.region_name || '').toLowerCase().replace(/\s+/g, '-'),
          currency: (r.currency || 'USD') as CurrencyCode,
          status: (r.status || 'Active').toUpperCase().includes('ACTIVE') ? 'ACTIVE' : 'INACTIVE',
          displayOrder: Number(r.display_order) || 1,
          description: r.description || '',
          heroImage: r.image_url || r.imageUrl || '',
          isPublished: true,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.regions.length} Regions.`);
      } else if (tabKey === 'DESTINATIONS') {
        payload.destinations = objects.map(d => {
          const rawRegId = d.region_id || d.regionId || 'REG-001';
          const regObj = MasterDataService.getInstance().getRegionById(rawRegId);
          const canonicalRegId = regObj ? regObj.id : rawRegId;

          return {
            id: d.destination_id || d.id,
            regionId: canonicalRegId,
            name: d.destination_name || d.name || 'Destination',
            country: d.country_name || d.country || d.destination_name || '',
            slug: d.slug || (d.destination_name || '').toLowerCase().replace(/\s+/g, '-'),
            currency: (d.base_currency || d.currency || 'USD') as CurrencyCode,
            status: (d.status || 'ACTIVE').toUpperCase().includes('COMING') ? 'COMING_SOON' : 'ACTIVE',
            displayOrder: Number(d.display_order) || 1,
            heroImage: d.hero_image_url || d.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
            description: d.description || '',
            region: d.region_name || regObj?.name || 'East Asia',
            tagline: `Premium Ground Logistics across ${d.destination_name || 'the Destination'}`,
            keySellingPoints: ['Curated 5-Star Accommodations', 'Private Chauffeur Fleet', '24/7 Dedicated DMC Operations'],
            bestTimeToVisit: 'Year-Round / Seasonal',
            idealTripDuration: '7–14 Days',
            travelStyle: 'Bespoke Luxury & Cultural Immersion',
            cities: [],
            highlights: ['Exclusive Experiences', 'VIP Airport Fast Track'],
            featuredProductIds: []
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.destinations.length} Destinations.`);
      } else if (tabKey === 'HUBS') {
        payload.hubs = objects.map(h => {
          const rawDestId = h.destination_id || h.destinationId || 'DST-JPN';
          const destObj = MasterDataService.getInstance().getDestinationById(rawDestId);
          const canonicalDestId = destObj ? destObj.id : rawDestId;
          const canonicalRegId = destObj ? destObj.regionId : 'REG-001';

          return {
            id: h.hub_id || h.id,
            destinationId: canonicalDestId,
            destinationName: destObj?.name || h.country || 'Destination',
            regionId: canonicalRegId,
            name: h.hub_name || h.name || 'City Hub',
            tagline: `${h.hub_type || 'City'} Gateway`,
            description: `Operational logistics hub in ${h.hub_name || 'destination'}.`,
            heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
            images: ['https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200'],
            displayOrder: Number(h.display_order) || 1,
            isPublished: true,
            status: (h.status || 'ACTIVE').toUpperCase().includes('ARCH') ? 'ARCHIVED' : 'ACTIVE',
            airportCode: h.airport_code || '',
            railwayStation: h.railway_station || '',
            latitude: Number(h.latitude) || undefined,
            longitude: Number(h.longitude) || undefined,
            productCount: 0,
            hotelCount: 0,
            highlights: []
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.hubs.length} City Hubs.`);
      } else if (tabKey === 'PRODUCTS') {
        payload.products = objects.map(p => {
          const rawCat = p.product_category || p.category || 'Private Tours';
          const authoritativeCat = resolveAuthoritativeCategory({ category: rawCat, name: p.product_name, sku: p.sku || p.product_id });
          const rawDays = p.operating_days || 'Mon;Tue;Wed;Thu;Fri;Sat;Sun';
          const operatingDays = Array.isArray(rawDays) 
            ? rawDays 
            : typeof rawDays === 'string' 
            ? rawDays.split(';').map((s: string) => s.trim()).filter(Boolean)
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

          const rawDestId = p.destination_id || p.destinationId || 'DST-JPN';
          const rawRegId = p.region_id || 'REG-001';
          const rawHubId = p.hub_id || 'HUB-TYO';

          const destObj = MasterDataService.getInstance().getDestinationById(rawDestId);
          const regObj = MasterDataService.getInstance().getRegionById(rawRegId) || (destObj ? MasterDataService.getInstance().getRegionById(destObj.regionId) : undefined);
          const hubObj = MasterDataService.getInstance().getHubById(rawHubId);

          const canonicalDestId = destObj ? destObj.id : rawDestId;
          const canonicalRegId = regObj ? regObj.id : rawRegId;
          const canonicalHubId = hubObj ? hubObj.id : rawHubId;

          const partialProd: Product = {
            id: p.product_id || p.sku || `PRD-${Date.now()}`,
            sku: p.product_id || p.sku || `SKU-${Date.now()}`,
            name: p.product_name || p.name || 'Travel Product',
            destinationId: canonicalDestId,
            destinationName: destObj?.name || p.destination_name || 'Japan',
            regionId: canonicalRegId,
            regionName: regObj?.name || 'East Asia',
            hubId: canonicalHubId,
            city: hubObj?.name || p.city || 'Tokyo',
            country: destObj?.country || destObj?.name || p.country || 'Japan',
            productType: p.product_category || p.category || authoritativeCat,
            category: authoritativeCat as any,
            subcategory: p.subcategory || 'Private Experience',
            duration: p.duration || '8 Hours',
            operatingDays: operatingDays.length > 0 ? operatingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            operatingHours: p.operating_hours || '09:00 - 18:00',
            adultNetPrice: Number(p.adult_nett) || Number(p.adultNetPrice) || 42000,
            childNetPrice: Number(p.child_nett) || Number(p.childNetPrice) || 22000,
            infantNetPrice: Number(p.infant_nett) || Number(p.infantNetPrice) || 0,
            sellingPriceStartingFrom: (Number(p.adult_nett) || 42000) * 1.2,
            currency: (p.currency || p.native_currency || 'JPY') as CurrencyCode,
            nativeCurrency: (p.native_currency || p.currency || 'JPY') as CurrencyCode,
            supplierId: p.supplier_code || 'sup-01',
            supplierName: p.supplier_name || 'Contracted DMC Ground Supplier',
            supplierLocalCurrency: (p.currency || 'JPY') as CurrencyCode,
            supplierProductCode: p.supplier_product_code || '',
            shortDescription: p.description || p.shortDescription || 'Luxury private tour with English docent.',
            longDescription: p.description || 'Comprehensive guided touring experience.',
            inclusions: ['Private Chauffeur', 'Guide', 'All Taxes'],
            exclusions: ['Personal Expenses'],
            importantInformation: ['Valid passport required', 'Voucher presented on arrival'],
            images: ['https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200'],
            cancellationPolicy: p.cancellation_policy || '100% refund up to 72h prior',
            bookingRequiredDays: 2,
            defaultMarkupPercent: 20,
            buyerMarkupPercent: 25,
            b2bAgentMarkupPercent: 15,
            taxPercent: 10,
            commissionPercent: 10,
            serviceFeeFixed: 0,
            season: 'All Year',
            validityFrom: '2026-01-01',
            validityTo: '2026-12-31',
            minPax: 1,
            maxPax: Number(p.max_capacity) || 6,
            availability: 'INSTANT',
            status: 'ACTIVE',
            pricingMethod: p.capacity_type === 'capacity_based' ? 'capacity_based' : 'per_person',
            lastUpdated: new Date().toISOString().split('T')[0]
          };

          return ensureMasterProductConfiguration(partialProd, user);
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.products.length} Products with Master Configurations.`);
      } else if (tabKey === 'PRODUCT_PRICING') {
        payload.productRates = objects.map(pr => ({
          id: pr.pricing_id || `PRC-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: pr.product_id,
          rateType: pr.rate_type || 'Standard',
          currency: (pr.currency || 'USD') as CurrencyCode,
          validityFrom: pr.validity_from || '2026-01-01',
          validityTo: pr.validity_to || '2026-12-31',
          adultNett: Number(pr.adult_nett) || 0,
          childNett: Number(pr.child_nett) || 0,
          cwbNett: Number(pr.cwb_nett) || 0,
          cnbNett: Number(pr.cnb_nett) || 0,
          infantNett: Number(pr.infant_nett) || 0,
          fixedCost: Number(pr.fixed_cost) || 0,
          perPersonCost: Number(pr.per_person_cost) || Number(pr.adult_nett) || 0,
          markupBuyer: Number(pr.markup_buyer) || 20,
          markupAgent: Number(pr.markup_agent) || 15,
          taxPercentage: Number(pr.tax_percentage) || 10,
          supplierName: pr.supplier_name || '',
          supplierRateReference: pr.supplier_rate_reference || '',
          status: 'ACTIVE'
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.productRates.length} Product Rates.`);
      } else if (tabKey === 'HOTELS') {
        payload.hotels = objects.map(h => ({
          id: h.hotel_id || h.id,
          code: h.code || h.hotel_id || h.id,
          name: h.hotel_name || h.name || 'Luxury Hotel',
          destinationId: h.destination_id || 'dest-japan',
          destinationName: 'Japan',
          cityId: h.hub_id || 'hub-tyo',
          cityName: 'Tokyo',
          city: 'Tokyo',
          country: 'Japan',
          area: h.area || 'Central District',
          propertyType: (h.property_type || 'LUXURY_HOTEL') as any,
          starRating: Number(h.star_rating) || 5,
          shortDescription: h.short_description || h.description || '5-Star Luxury Accommodation',
          description: h.description || '5-Star Luxury Accommodation in premier district.',
          heroImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200',
          images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200'],
          website: h.official_website || '',
          address: h.address || 'Central District',
          latitude: Number(h.latitude) || 35.6762,
          longitude: Number(h.longitude) || 139.6503,
          locationDetails: {
            airportName: 'Haneda / Narita International Airport',
            airportDistanceKm: 20,
            airportTransferTimeMins: 30,
            railwayStationName: 'Tokyo Central Station',
            railwayDistanceKm: 2,
            walkingDistanceMins: 5,
            metroStationName: 'Ginza Station',
            nearbyAttractions: ['Imperial Palace', 'Ginza Shopping']
          },
          roomTypes: [],
          amenities: ['Spa & Wellness', 'Michelin-starred Dining', 'Concierge Service', 'High-speed Wi-Fi'],
          blackoutDates: [],
          status: 'PUBLISHED',
          startingNetPrice: Number(h.starting_price) || 280,
          currency: (h.currency || 'USD') as CurrencyCode,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.hotels.length} Hotels.`);
      } else if (tabKey === 'HOTEL_ROOMS') {
        payload.hotelRooms = objects.map(hr => ({
          id: hr.room_id || hr.id,
          roomName: hr.room_name || 'Deluxe Room',
          roomCategory: hr.room_category || 'Suite',
          description: hr.description || 'Spacious luxury accommodation with private ensuite.',
          images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200'],
          bedType: hr.bed_type || 'King Bed',
          numberOfBeds: 1,
          roomSizeSqMeters: 45,
          maxAdults: Number(hr.max_adults) || 2,
          maxChildren: Number(hr.max_cwb) || 1,
          maxOccupancy: (Number(hr.max_adults) || 2) + 2,
          extraBedAvailable: String(hr.extra_bed_allowed).toUpperCase() === 'TRUE',
          childPolicy: 'Children under 6 stay free with existing bedding',
          amenities: ['High-speed Wi-Fi', 'Nespresso Coffee', 'L\'Occitane Bath Amenities'],
          view: 'City Skyline',
          cancellationPolicy: 'Free cancellation up to 7 days prior',
          rates: []
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.hotelRooms.length} Hotel Rooms.`);
      } else if (tabKey === 'HOTEL_MEAL_PLANS') {
        payload.hotelMealPlans = objects.map(mp => ({
          id: mp.meal_plan_id || mp.id,
          hotelId: mp.hotel_id,
          mealCode: mp.meal_code as any,
          mealName: mp.meal_name || 'Breakfast Included',
          description: mp.description || '',
          status: 'ACTIVE'
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.hotelMealPlans.length} Hotel Meal Plans.`);
      } else if (tabKey === 'TRANSFER_ROUTES') {
        payload.transferRoutes = objects.map(tr => ({
          id: tr.route_id || tr.id,
          destinationId: tr.destination_id,
          fromHubId: tr.from_hub_id,
          toHubId: tr.to_hub_id,
          routeName: tr.route_name || 'Transfer Route',
          transferType: (tr.transfer_type || 'AIRPORT_ARRIVAL') as any,
          vehicleType: tr.vehicle_type || 'Executive MPV',
          maxCapacity: Number(tr.max_capacity) || 6,
          status: 'ACTIVE'
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.transferRoutes.length} Transfer Routes.`);
      } else if (tabKey === 'TRANSFER_RATES') {
        payload.transferRates = objects.map(tr => ({
          id: tr.transfer_rate_id || `TRATE-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          routeId: tr.route_id,
          rateType: (tr.rate_type || 'PRIVATE') as any,
          vehicle: tr.vehicle || 'Executive MPV',
          capacity: Number(tr.capacity) || 6,
          currency: (tr.currency || 'USD') as CurrencyCode,
          nettCost: Number(tr.nett_cost) || 0,
          status: 'ACTIVE'
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.transferRates.length} Transfer Rates.`);
      } else if (tabKey === 'VISA_ANCILLARY') {
        const visas: VisaProduct[] = [];
        const travelProtections: TravelProtectionPlan[] = [];
        const vipGrounds: VipGroundService[] = [];
        const connectivities: ConnectivityPlan[] = [];

        for (const item of objects) {
          const group = (item.service_group || item.group || '').toString().toUpperCase();
          const id = item.service_id || item.id;
          if (!id) continue;

          if (group === 'VISA' || id.startsWith('VSA')) {
            visas.push({
              id,
              destinationId: item.destination_id || 'DST-JPN',
              country: 'Japan',
              visaType: item.service_name || 'Tourist Visa',
              entryType: 'SINGLE_ENTRY',
              validityDays: 90,
              stayDurationDays: 30,
              processingTimeDays: 5,
              expressProcessingAvailable: true,
              embassyFee: Number(item.supplier_nett) || 35,
              serviceFee: Number(item.service_fee_value) || 15,
              currency: (item.native_currency || 'USD') as CurrencyCode,
              description: item.coverage_or_scope || 'Visa Facilitation & Processing',
              documentsChecklist: (item.requirements_summary || '').split('|').filter(Boolean),
              status: 'ACTIVE',
              structuredRequirements: createDefaultRequirementsForVisa(id, 'Japan', item.service_name || 'Tourist Visa'),
              assistanceServices: createDefaultAssistanceServices(id),
              requirementVersion: 1,
              submissionSteps: ['Document Review & Digital Verification', 'Biometrics & Consulate Appointment', 'Passport Stamping & Delivery'],
              eligibilityNotes: ['Valid for tourism and leisure travel', 'Passport must have at least 6 months validity'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else if (group === 'TRAVEL_PROTECTION' || id.startsWith('ANC-INS')) {
            travelProtections.push({
              id,
              serviceName: item.service_name || 'Travel Protection Plan',
              provider: 'Global Assistance Provider',
              coverageArea: 'Worldwide',
              destinationId: item.destination_id || undefined,
              medicalCoverageAmount: 250000,
              emergencyAssistanceIncluded: true,
              evacuationCoverageAmount: 100000,
              tripCancellationAmount: 5000,
              baggageLossAmount: 2000,
              validityDaysMax: 30,
              eligibilityAgeMin: 0,
              eligibilityAgeMax: 85,
              netCostPerDay: 3.5,
              netCostPerTrip: Number(item.supplier_nett) || 25,
              sellingPricePerDay: 5.5,
              sellingPricePerTrip: Math.round((Number(item.supplier_nett) || 25) * 1.2),
              currency: (item.native_currency || 'USD') as CurrencyCode,
              status: 'ACTIVE',
              terms: 'Policy terms apply',
              customerDescription: item.coverage_or_scope || 'Medical & Cancellation Protection',
              inclusions: (item.requirements_summary || '').split('|').filter(Boolean),
              pricing: {
                currency: (item.native_currency || 'USD') as CurrencyCode,
                nettPrice: Number(item.supplier_nett) || 25,
                marginType: 'PERCENTAGE',
                marginValue: 20,
                finalPrice: Math.round((Number(item.supplier_nett) || 25) * 1.2),
                taxType: 'PERCENTAGE',
                taxValue: 0,
                serviceChargeType: 'FIXED',
                serviceChargeValue: 0,
                pricingUnit: 'Per Trip'
              },
              displayOrder: 1,
              updatedAt: new Date().toISOString()
            });
          } else if (group === 'VIP_GROUND' || id.startsWith('VIP')) {
            vipGrounds.push({
              id,
              name: item.service_name || 'VIP Ground Service',
              serviceType: 'MEET_AND_GREET',
              destinationId: item.destination_id || 'DST-JPN',
              hubId: item.hub_id || 'HUB-TOKYO',
              supplierName: item.supplier_id || 'Supplier',
              shortDesc: item.coverage_or_scope || 'VIP Fast-Track Escort',
              longDesc: item.coverage_or_scope || 'VIP Ground Service',
              netCost: Number(item.supplier_nett) || 120,
              defaultMarkupPercent: 20,
              sellingPrice: Math.round((Number(item.supplier_nett) || 120) * 1.2),
              currency: (item.native_currency || 'USD') as CurrencyCode,
              pricingType: 'PER_PAX' as any,
              badge: 'VIP Escort',
              status: 'ACTIVE',
              inclusions: (item.requirements_summary || '').split('|').filter(Boolean),
              pricing: {
                currency: (item.native_currency || 'USD') as CurrencyCode,
                nettPrice: Number(item.supplier_nett) || 120,
                marginType: 'PERCENTAGE',
                marginValue: 20,
                finalPrice: Math.round((Number(item.supplier_nett) || 120) * 1.2),
                taxType: 'PERCENTAGE',
                taxValue: 0,
                serviceChargeType: 'FIXED',
                serviceChargeValue: 0,
                pricingUnit: 'Per Pax'
              },
              displayOrder: 1,
              updatedAt: new Date().toISOString()
            });
          } else if (group === 'CONNECTIVITY' || id.startsWith('ANC-ESIM')) {
            connectivities.push({
              id,
              name: item.service_name || '5G eSIM Data Plan',
              type: 'ESIM',
              coverageZone: 'Japan',
              dataAllowance: item.coverage_or_scope || 'Unlimited 5G Data',
              validityDays: 15,
              networkSpeed: '5G / 4G LTE',
              netCost: Number(item.supplier_nett) || 18,
              sellingPrice: Math.round((Number(item.supplier_nett) || 18) * 1.2),
              currency: (item.native_currency || 'USD') as CurrencyCode,
              status: 'ACTIVE',
              inclusions: (item.requirements_summary || '').split('|').filter(Boolean),
              pricing: {
                currency: (item.native_currency || 'USD') as CurrencyCode,
                nettPrice: Number(item.supplier_nett) || 18,
                marginType: 'PERCENTAGE',
                marginValue: 20,
                finalPrice: Math.round((Number(item.supplier_nett) || 18) * 1.2),
                taxType: 'PERCENTAGE',
                taxValue: 0,
                serviceChargeType: 'FIXED',
                serviceChargeValue: 0,
                pricingUnit: 'Per Profile'
              },
              displayOrder: 1,
              updatedAt: new Date().toISOString()
            });
          }
        }

        if (visas.length > 0) payload.visas = visas;
        if (travelProtections.length > 0) payload.travelProtectionPlans = travelProtections;
        if (vipGrounds.length > 0) payload.vipGroundServices = vipGrounds;
        if (connectivities.length > 0) payload.connectivityPlans = connectivities;
        logs.push(`[${new Date().toLocaleTimeString()}] Staged Visa & Ancillary Services (${visas.length} Visas, ${travelProtections.length} Insurance, ${vipGrounds.length} VIP, ${connectivities.length} eSIM).`);
      } else if (tabKey === 'RAIL') {
        const railRoutes: RailRoute[] = [];
        const railFares: RailFare[] = [];

        for (const item of objects) {
          const id = item.rail_id || item.id;
          if (!id) continue;

          railRoutes.push({
            routeId: item.route_code || id,
            originStationId: item.origin_station_id || 'STN-TOKYO',
            destinationStationId: item.destination_station_id || 'STN-OSAKA',
            originStationName: item.origin_station_name || 'Tokyo Station',
            destinationStationName: item.destination_station_name || 'Shin-Osaka Station',
            country: 'Japan',
            destinationId: 'dest-japan',
            railOperator: 'JR Central',
            availableProductIds: [item.commercial_product || 'GREEN_RESERVED'],
            availableServiceGroups: ['NOZOMI_MIZUHO'],
            distanceKm: 515,
            durationMinutes: Number(item.duration_minutes) || 150,
            active: true,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          railFares.push({
            railFareId: id,
            routeId: item.route_code || id,
            originStationId: item.origin_station_id || 'STN-TOKYO',
            destinationStationId: item.destination_station_id || 'STN-OSAKA',
            productId: item.commercial_product || 'GREEN_RESERVED',
            carType: (item.travel_class?.includes('Green') ? 'Green' : 'Ordinary') as any,
            seatType: 'Reserved',
            fareType: 'Standard',
            passengerType: (item.passenger_type || 'Adult').toUpperCase() as any,
            currency: (item.native_currency || 'JPY') as CurrencyCode,
            nettPrice: Number(item.supplier_nett) || 14720,
            marginType: item.margin_type || 'PERCENTAGE',
            marginValue: Number(item.b2b_margin_value) || 10,
            taxType: item.tax_type || 'PERCENTAGE',
            taxValue: Number(item.tax_value) || 10,
            serviceChargeType: item.service_fee_type || 'FIXED',
            serviceChargeValue: Number(item.service_fee_value) || 0,
            finalPrice: Math.round((Number(item.supplier_nett) || 14720) * 1.1),
            effectiveFrom: '2026-01-01',
            effectiveTo: '2026-12-31',
            status: 'ACTIVE',
            updatedAt: new Date().toISOString()
          });
        }

        if (railRoutes.length > 0) payload.railRoutes = railRoutes;
        if (railFares.length > 0) payload.railFares = railFares;
        logs.push(`[${new Date().toLocaleTimeString()}] Staged Japan Rail Journeys (${railRoutes.length} Routes, ${railFares.length} Fares).`);
      } else if (tabKey === 'VISA') {
        const existingVisasMap = new Map(db.getVisas().map(v => [v.id, v]));
        payload.visas = objects.map(v => {
          const visaId = v.visa_id || v.id;
          const country = v.country || 'Japan';
          const visaType = v.visa_type || 'Tourist E-Visa';
          const existing = existingVisasMap.get(visaId);
          const docList = (v.documentation || 'Original Passport;Passport Photos;Flight Itinerary;Hotel Confirmation').split(';').map((s: string) => s.trim()).filter(Boolean);

          return {
            id: visaId,
            destinationId: v.destination_id || 'dest-japan',
            country,
            visaType,
            entryType: (v.entry_type || 'SINGLE_ENTRY') as any,
            validityDays: Number(v.validity_days) || 90,
            stayDurationDays: Number(v.stay_days) || 30,
            processingTimeDays: Number(v.processing_days) || 5,
            expressProcessingAvailable: String(v.express_available).toUpperCase() === 'TRUE',
            embassyFee: Number(v.embassy_fee) || 25,
            serviceFee: Number(v.service_fee) || 70,
            currency: (v.currency || 'USD') as CurrencyCode,
            description: v.service_description || v.description || 'Comprehensive diplomatic visa submission and concierge handling.',
            documentsChecklist: docList,
            structuredRequirements: existing?.structuredRequirements && existing.structuredRequirements.length > 0
              ? existing.structuredRequirements
              : createDefaultRequirementsForVisa(visaId, country, visaType),
            assistanceServices: existing?.assistanceServices && existing.assistanceServices.length > 0
              ? existing.assistanceServices
              : createDefaultAssistanceServices(visaId),
            requirementVersion: existing?.requirementVersion || 1,
            submissionSteps: existing?.submissionSteps || ['Document Review & Digital Verification', 'Biometrics & Consulate Appointment', 'Passport Stamping & Delivery'],
            eligibilityNotes: existing?.eligibilityNotes || ['Valid for tourism and leisure travel', 'Passport must have at least 6 months validity'],
            status: 'ACTIVE',
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.visas.length} Visas.`);
      } else if (tabKey === 'PACKAGES') {
        payload.packages = objects.map(pkg => ({
          id: pkg.package_id || pkg.id,
          title: pkg.package_name || pkg.title || 'Curated Circuit',
          slug: (pkg.package_name || pkg.title || 'package').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: pkg.description || '',
          destinationId: pkg.destination_id || 'dest-japan',
          destinationName: 'Japan',
          tagline: 'Exclusive Guided Itinerary',
          durationNights: Number(pkg.nights) || 5,
          durationDays: (Number(pkg.nights) || 5) + 1,
          status: 'PUBLISHED',
          heroImage: pkg.image_url || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
          routeSummary: ['Tokyo (3N)', 'Kyoto (2N)'],
          hotelsSummary: [],
          productIds: [],
          highlights: ['Private Sightseeing', 'High-Speed Shinkansen', 'Concierge Service'],
          inclusions: ['Luxury Accommodations', 'Private Transfers', 'Breakfast Daily'],
          exclusions: ['International Airfare', 'Personal Gratuities'],
          baseNetCostUSD: 1450,
          suggestedSellingPriceUSD: 1850,
          currency: 'USD',
          tripType: 'LUXURY',
          tags: ['Luxury', 'Chauffeur', 'Private'],
          isPublished: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.packages.length} Packages.`);
      } else if (tabKey === 'PRODUCT_CAPACITY') {
        payload.productCapacities = objects.map(pc => {
          const rawSupplierNett = pc.supplier_nett ?? pc.supplier_nett_cost ?? pc.nett_price ?? pc.fixed_cost;
          let supplierNett: number | undefined = undefined;
          if (rawSupplierNett !== undefined && rawSupplierNett !== null && String(rawSupplierNett).trim() !== '') {
            const num = parseFloat(String(rawSupplierNett));
            if (!isNaN(num) && isFinite(num)) {
              supplierNett = num;
            }
          }

          const paxFrom = Number(pc.pax_from ?? pc.minimum_passengers ?? pc.min_pax ?? 1) || 1;
          const paxTo = Number(pc.pax_to ?? pc.maximum_passengers ?? pc.max_pax ?? pc.capacity ?? 6) || 6;
          const vCount = Number(pc.vehicle_count ?? pc.vehicles ?? 1) || 1;
          const curr = (pc.currency || pc.native_currency || 'USD') as CurrencyCode;

          return {
            id: pc.capacity_id || pc.id || `CAP-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            productId: pc.product_id,
            category: pc.category || pc.product_category,
            fleetId: pc.fleet_id,
            capacity: paxTo,
            minPassengers: paxFrom,
            maxPassengers: paxTo,
            vehicleCount: vCount,
            vehicleModel: pc.vehicle_model || 'Executive MPV',
            supplierNett: supplierNett,
            fixedNettCost: supplierNett ?? (Number(pc.fixed_cost) || 0),
            currency: curr,
            nativeCurrency: curr,
            margin: pc.margin !== undefined && pc.margin !== '' ? Number(pc.margin) : undefined,
            tax: pc.tax !== undefined && pc.tax !== '' ? Number(pc.tax) : undefined,
            serviceCharge: pc.service_charge !== undefined && pc.service_charge !== '' ? Number(pc.service_charge) : undefined,
            finalPrice: pc.final_price !== undefined && pc.final_price !== '' ? Number(pc.final_price) : undefined,
            effectiveFrom: pc.effective_from || '',
            effectiveTo: pc.effective_to || '',
            status: (pc.status && String(pc.status).toUpperCase() === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE'
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.productCapacities.length} Product Capacities with authoritative Supplier Nett mapping.`);
      } else if (tabKey === 'HOTEL_RATES') {
        payload.hotelRates = objects.map(hr => ({
          id: hr.hotel_rate_id || hr.id || `HRATE-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          hotelId: hr.hotel_id,
          roomId: hr.room_id,
          mealPlan: (hr.meal_code || 'BB') as MealPlanCode,
          mealPlanName: hr.meal_name || 'Breakfast Included',
          singleNetRate: Number(hr.adult_nett) || 0,
          doubleNetRate: Number(hr.adult_nett) || 0,
          tripleNetRate: Math.round((Number(hr.adult_nett) || 0) * 1.4),
          extraBedRate: Number(hr.extra_bed_nett) || 0,
          childRate: Number(hr.cwb_nett) || Number(hr.cnb_nett) || 0,
          adultNettCost: Number(hr.adult_nett) || 0,
          markupPercent: 20,
          taxPercent: 10,
          feePercent: 0,
          currency: (hr.currency || 'USD') as CurrencyCode,
          validityFrom: hr.validity_from || '2026-01-01',
          validityTo: hr.validity_to || '2026-12-31'
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.hotelRates.length} Hotel Rates.`);
      } else if (tabKey === 'VISA_RATES') {
        payload.visaRates = objects.map(vr => ({
          id: vr.visa_rate_id || vr.id || `VRATE-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          visaId: vr.visa_id,
          currency: (vr.currency || 'USD') as CurrencyCode,
          validityFrom: vr.validity_from || '2026-01-01',
          validityTo: vr.validity_to || '2026-12-31',
          adultNett: Number(vr.adult_nett) || 0,
          childNett: Number(vr.child_nett) || 0,
          infantNett: Number(vr.infant_nett) || 0,
          serviceFee: Number(vr.service_fee) || 0,
          markupBuyer: Number(vr.markup_buyer) || 15,
          markupAgent: Number(vr.markup_agent) || 10,
          status: 'ACTIVE'
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.visaRates.length} Visa Rates.`);
      } else if (tabKey === 'TRAVEL_PROTECTION') {
        payload.travelProtectionPlans = objects.map(p => {
          const rawInclusions = p.inclusions || 'USD 500,000 Medical Cover; 24/7 Global Helpline';
          const inclusionsList = typeof rawInclusions === 'string'
            ? rawInclusions.split(';').map((s: string) => s.trim()).filter(Boolean)
            : Array.isArray(rawInclusions) ? rawInclusions : ['USD 500,000 Medical Cover'];
          const netTrip = Number(p.net_cost_per_trip) || 35;
          const sellTrip = Number(p.selling_price_per_trip) || 55;

          return {
            id: p.protection_id || p.id || `PROT-${Date.now()}`,
            serviceName: p.service_name || p.name || 'Travel Protection Shield',
            provider: p.provider || 'Allianz Global Assistance',
            coverageArea: p.coverage_area || 'Worldwide incl. US/Canada',
            destinationId: p.destination_id || undefined,
            medicalCoverageAmount: Number(p.medical_coverage_amount) || 250000,
            emergencyAssistanceIncluded: String(p.emergency_assistance_included).toUpperCase() === 'TRUE' || Boolean(p.emergency_assistance_included),
            evacuationCoverageAmount: Number(p.evacuation_coverage_amount) || 100000,
            tripCancellationAmount: Number(p.trip_cancellation_amount) || 5000,
            baggageLossAmount: Number(p.baggage_loss_amount) || 2000,
            validityDaysMax: Number(p.validity_days_max) || 30,
            eligibilityAgeMin: Number(p.eligibility_age_min) || 0,
            eligibilityAgeMax: Number(p.eligibility_age_max) || 85,
            netCostPerDay: Number(p.net_cost_per_day) || 3.5,
            netCostPerTrip: netTrip,
            sellingPricePerDay: Number(p.selling_price_per_day) || 5.5,
            sellingPricePerTrip: sellTrip,
            currency: (p.currency || 'USD') as CurrencyCode,
            status: (p.status || 'ACTIVE').toUpperCase().includes('ACT') ? 'ACTIVE' : 'INACTIVE',
            terms: p.terms || 'Full policy conditions apply.',
            customerDescription: p.customer_description || 'Comprehensive medical and transit travel protection.',
            inclusions: inclusionsList,
            displayOrder: Number(p.display_order) || 1,
            pricing: {
              currency: (p.currency || 'USD') as CurrencyCode,
              nettPrice: netTrip,
              marginType: 'FIXED',
              marginValue: Math.max(0, sellTrip - netTrip),
              finalPrice: sellTrip,
              taxType: 'PERCENTAGE',
              taxValue: 0,
              serviceChargeType: 'FIXED',
              serviceChargeValue: 0,
              pricingUnit: 'Per Trip'
            },
            updatedByRole: 'ADMIN',
            updatedByEmail: 'business@theunbound.in',
            updatedBy: 'usr-admin-business',
            updatedAt: new Date().toISOString()
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.travelProtectionPlans.length} Travel Protection Plans.`);
      } else if (tabKey === 'VIP_GROUND') {
        payload.vipGroundServices = objects.map(v => {
          const rawInclusions = v.inclusions || 'VIP greeting; Priority escort';
          const inclusionsList = typeof rawInclusions === 'string'
            ? rawInclusions.split(';').map((s: string) => s.trim()).filter(Boolean)
            : Array.isArray(rawInclusions) ? rawInclusions : ['VIP greeting'];
          const netCost = Number(v.net_cost) || 120;
          const sellPrice = Number(v.selling_price) || 150;
          const markupPct = Number(v.default_markup_percent) || 25;

          return {
            id: v.vip_id || v.id || `VIP-${Date.now()}`,
            name: v.name || 'VIP Meet & Fast Track Service',
            serviceType: (v.service_type || 'MEET_AND_GREET') as any,
            destinationId: v.destination_id || 'dest-japan',
            hubId: v.hub_id || 'hub-tokyo',
            supplierName: v.supplier_name || 'Ground Concierge Desk',
            shortDesc: v.short_desc || 'Airside VIP meet and assist service.',
            longDesc: v.long_desc || 'Dedicated executive ground assistant escorting passengers through priority lanes.',
            netCost,
            defaultMarkupPercent: markupPct,
            sellingPrice: sellPrice,
            pricingType: (v.pricing_type || 'PER_PAX') as any,
            currency: (v.currency || 'USD') as CurrencyCode,
            badge: v.badge || 'VIP Escort',
            inclusions: inclusionsList,
            status: (v.status || 'ACTIVE').toUpperCase().includes('ACT') ? 'ACTIVE' : 'INACTIVE',
            displayOrder: Number(v.display_order) || 1,
            pricing: {
              currency: (v.currency || 'USD') as CurrencyCode,
              nettPrice: netCost,
              marginType: 'PERCENTAGE',
              marginValue: markupPct,
              finalPrice: sellPrice,
              taxType: 'PERCENTAGE',
              taxValue: 0,
              serviceChargeType: 'FIXED',
              serviceChargeValue: 0,
              pricingUnit: 'Per Passenger'
            },
            updatedByRole: 'ADMIN',
            updatedByEmail: 'business@theunbound.in',
            updatedBy: 'usr-admin-business',
            updatedAt: new Date().toISOString()
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.vipGroundServices.length} VIP Ground Services.`);
      } else if (tabKey === 'CONNECTIVITY') {
        payload.connectivityPlans = objects.map(c => {
          const rawInclusions = c.inclusions || 'Instant eSIM QR delivery; Hotspot enabled';
          const inclusionsList = typeof rawInclusions === 'string'
            ? rawInclusions.split(';').map((s: string) => s.trim()).filter(Boolean)
            : Array.isArray(rawInclusions) ? rawInclusions : ['Instant eSIM QR delivery'];
          const netCost = Number(c.net_cost) || 12;
          const sellPrice = Number(c.selling_price) || 18;

          return {
            id: c.connectivity_id || c.id || `ESIM-${Date.now()}`,
            name: c.name || '5G Roaming eSIM',
            type: (c.type || 'ESIM') as any,
            coverageZone: c.coverage_zone || 'Asia Regional',
            dataAllowance: c.data_allowance || '10GB High-Speed 5G',
            validityDays: Number(c.validity_days) || 15,
            networkSpeed: c.network_speed || '5G / 4G LTE',
            netCost,
            sellingPrice: sellPrice,
            currency: (c.currency || 'USD') as CurrencyCode,
            status: (c.status || 'ACTIVE').toUpperCase().includes('ACT') ? 'ACTIVE' : 'INACTIVE',
            inclusions: inclusionsList,
            displayOrder: Number(c.display_order) || 1,
            pricing: {
              currency: (c.currency || 'USD') as CurrencyCode,
              nettPrice: netCost,
              marginType: 'FIXED',
              marginValue: Math.max(0, sellPrice - netCost),
              finalPrice: sellPrice,
              taxType: 'PERCENTAGE',
              taxValue: 0,
              serviceChargeType: 'FIXED',
              serviceChargeValue: 0,
              pricingUnit: 'Per eSIM Profile'
            },
            updatedByRole: 'ADMIN',
            updatedByEmail: 'business@theunbound.in',
            updatedBy: 'usr-admin-business',
            updatedAt: new Date().toISOString()
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.connectivityPlans.length} Connectivity Plans.`);
      } else if (tabKey === 'PACKAGE_ITEMS') {
        payload.packageItems = objects.map(pi => ({
          id: pi.package_item_id || pi.id || `PKGITEM-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          packageId: pi.package_id,
          dayNumber: Number(pi.day_number) || 1,
          hubId: pi.hub_id || 'HUB-TYO',
          itemType: (pi.item_type || 'product') as any,
          itemId: pi.item_id,
          quantity: Number(pi.quantity) || 1,
          remarks: pi.remarks || ''
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.packageItems.length} Package Items.`);
      } else if (tabKey === 'RAIL_STATIONS') {
        payload.railStations = objects.map(s => ({
          stationId: s.station_id || s.id,
          stationCode: s.station_code || (s.station_id || '').split('-').pop() || 'STN',
          stationName: s.station_name || 'Station',
          stationNameLocal: s.station_name_local || '',
          displayName: `${s.station_name || 'Station'}${s.station_name_local ? ` (${s.station_name_local})` : ''}`,
          searchAliases: [s.station_name || '', s.station_code || '', s.city || ''].filter(Boolean),
          country: s.country || 'Japan',
          regionId: s.region_id || 'reg-east-asia',
          destinationId: s.destination_id || 'dest-japan',
          hubId: s.hub_id || 'hub-tokyo',
          city: s.city || 'Tokyo',
          railOperator: s.rail_operator || 'JR Central',
          latitude: Number(s.latitude) || 35.6812,
          longitude: Number(s.longitude) || 139.7671,
          timezone: s.timezone || 'Asia/Tokyo',
          shinkansenLine: s.shinkansen_line || 'Tokaido Shinkansen',
          isMajorHub: String(s.is_major_hub).toUpperCase() === 'TRUE' || Boolean(s.is_major_hub),
          active: String(s.status || 'ACTIVE').toUpperCase().includes('ACT'),
          status: (s.status || 'ACTIVE').toUpperCase().includes('ACT') ? 'ACTIVE' : 'INACTIVE',
          displayOrder: Number(s.display_order) || 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.railStations.length} Japan Rail Stations.`);
      } else if (tabKey === 'RAIL_ROUTES') {
        payload.railRoutes = objects.map(r => ({
          routeId: r.route_id || r.id,
          originStationId: r.origin_station_id,
          destinationStationId: r.destination_station_id,
          originStationName: r.origin_station_name || 'Origin',
          destinationStationName: r.destination_station_name || 'Destination',
          country: 'Japan',
          destinationId: r.destination_id || 'dest-japan',
          railOperator: r.rail_operator || 'JR Central / JR West',
          availableProductIds: ['RAIL-JP-ORD-RESERVED', 'RAIL-JP-GREEN-RESERVED'],
          availableServiceGroups: ['NOZOMI_MIZUHO', 'HIKARI_KODAMA_SAKURA_TSUBAME'],
          distanceKm: Number(r.distance_km) || 0,
          durationMinutes: Number(r.duration_minutes) || 120,
          active: String(r.status || 'ACTIVE').toUpperCase().includes('ACT'),
          status: (r.status || 'ACTIVE').toUpperCase().includes('ACT') ? 'ACTIVE' : 'INACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.railRoutes.length} Japan Rail Routes.`);
      } else if (tabKey === 'RAIL_SERVICES') {
        payload.railServices = objects.map(srv => {
          const rawDays = srv.operating_days || 'Mon;Tue;Wed;Thu;Fri;Sat;Sun';
          const operatingDaysList = typeof rawDays === 'string'
            ? rawDays.split(';').map(d => d.trim()).filter(Boolean)
            : Array.isArray(rawDays) ? rawDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

          return {
            serviceId: srv.service_id || srv.id,
            operatorId: srv.operator_id || 'JR-CENTRAL',
            serviceName: srv.service_name || 'Express Service',
            serviceType: srv.service_type || 'NOZOMI',
            trainNumber: srv.train_number || '1A',
            originStationId: srv.origin_station_id,
            destinationStationId: srv.destination_station_id,
            routeId: srv.route_id,
            departureTime: srv.departure_time || '06:00',
            arrivalTime: srv.arrival_time || '08:00',
            durationMinutes: Number(srv.duration_minutes) || 120,
            operatingDays: operatingDaysList,
            status: (srv.status || 'ACTIVE').toUpperCase().includes('ACT') ? 'ACTIVE' : 'INACTIVE',
            effectiveFrom: srv.effective_from || '2026-01-01',
            effectiveTo: srv.effective_to || '2026-12-31',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.railServices.length} Japan Rail Services.`);
      } else if (tabKey === 'RAIL_FARES') {
        payload.railFares = objects.map(f => {
          const nettPrice = Number(f.nett_price) || 0;
          const marginVal = Number(f.margin_value) || 15;
          const marginType = (f.margin_type || 'PERCENTAGE') as any;
          const marginAmt = marginType === 'PERCENTAGE' ? nettPrice * (marginVal / 100) : marginVal;
          const taxVal = Number(f.tax_value) || 10;
          const taxType = (f.tax_type || 'PERCENTAGE') as any;
          const taxAmt = taxType === 'PERCENTAGE' ? (nettPrice + marginAmt) * (taxVal / 100) : taxVal;
          const svcVal = Number(f.service_charge_value) || 500;
          const svcType = (f.service_charge_type || 'FIXED') as any;
          const svcAmt = svcType === 'PERCENTAGE' ? nettPrice * (svcVal / 100) : svcVal;
          const computedFinal = Math.round(nettPrice + marginAmt + taxAmt + svcAmt);

          return {
            railFareId: f.rail_fare_id || f.id || `FARE-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            routeId: f.route_id,
            originStationId: f.origin_station_id,
            destinationStationId: f.destination_station_id,
            productId: f.product_id || 'RAIL-JP-ORD-RESERVED',
            carType: (f.car_type || 'Ordinary') as any,
            seatType: (f.seat_type || 'Reserved') as any,
            fareType: f.fare_type || 'Standard',
            passengerType: (f.passenger_type || 'ADULT') as any,
            currency: (f.currency || 'JPY') as CurrencyCode,
            nettPrice,
            marginType,
            marginValue: marginVal,
            taxType,
            taxValue: taxVal,
            serviceChargeType: svcType,
            serviceChargeValue: svcVal,
            finalPrice: Number(f.final_price) || computedFinal,
            effectiveFrom: f.effective_from || '2026-01-01',
            effectiveTo: f.effective_to || '2026-12-31',
            status: (f.status || 'ACTIVE').toUpperCase().includes('ACT') ? 'ACTIVE' : 'INACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.railFares.length} Japan Rail Fares.`);
      } else if (tabKey === 'RAIL_CLASS_RULES') {
        payload.railSeasons = objects.map(s => ({
          id: s.season_id || s.id || `SEAS-${Date.now()}`,
          seasonType: (s.season_type || 'REGULAR') as any,
          title: s.title || s.season_name || 'Season Rule',
          startDate: s.start_date || '2026-01-01',
          endDate: s.end_date || '2026-12-31',
          adultAdjustmentJPY: Number(s.adult_adjustment_jpy) || 0,
          childAdjustmentJPY: Number(s.child_adjustment_jpy) || 0,
          pricingMultiplier: Number(s.pricing_multiplier) || 1.0,
          priority: Number(s.priority) || 1,
          active: (s.status || 'ACTIVE').toUpperCase().includes('ACT'),
          notes: s.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.railSeasons.length} Japan Rail Season & Class Rules.`);
      } else if (tabKey === 'FX_RATES') {
        const ce = CurrencyEngine.getInstance();
        for (const r of objects) {
          const pairId = r.pair_id || r.id;
          if (pairId && r.manual_adjustment !== undefined && r.manual_adjustment !== '') {
            ce.updatePairAdjustment(pairId, Number(r.manual_adjustment), user || null, 'Master Google Sheets FX_RATES sync');
          }
        }
        logs.push(`[${new Date().toLocaleTimeString()}] Synchronized ${objects.length} Google Finance FX Rates (=GOOGLEFINANCE).`);
      }
    }

    // 4. Save atomic payload into AppDatabase & sync to Firestore
    db.saveSyncedMultiTabData(payload, user);
    logs.push(`[${new Date().toLocaleTimeString()}] Successfully synchronized all staged entities to local database and Firestore.`);

    const durationMs = Date.now() - startTime;
    const report: MultiTabSyncReport = {
      id: `sync-batch-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userEmail: user?.email || 'admin@theunbound.in',
      sheetId,
      syncMode: selectedTabs && selectedTabs.length > 0 ? 'SELECTED_TABS' : 'FULL_SYNC',
      tabsProcessed: tabsToProcess,
      durationMs,
      status: validation.isValid ? 'SUCCESS' : 'COMPLETED_WITH_ERRORS',
      totalRecords: createdTotal + updatedTotal + unchangedTotal,
      createdTotal,
      updatedTotal,
      unchangedTotal,
      errorsTotal,
      tabDiffs: diffs,
      validationErrors: validation.errors,
      logs
    };

    db.saveMultiTabSyncReport(report);
    db.logAudit(user || null, 'GOOGLE_SHEETS_SYNC', 'GoogleSheets', sheetId, `Executed Multi-Tab Sync across ${tabsToProcess.length} tabs (+${createdTotal} created, ~${updatedTotal} updated).`);

    return report;
  }

  /**
   * Backwards compatible single sheet product sync
   */
  public async executeSync(
    sheetId: string,
    sheetName: string,
    user: User | null
  ): Promise<SyncDetailedReport> {
    const startTime = Date.now();
    const rows = await this.fetchRemoteWorksheet(sheetId, sheetName);
    
    const multiTabData: RawMultiTabData = {};
    if (rows && rows.length > 0) {
      multiTabData['PRODUCTS'] = rows;
    } else {
      // Use sample data from template
      const def = getTabSchemaByName('PRODUCTS');
      if (def) {
        multiTabData['PRODUCTS'] = [def.columns.map(c => c.name), ...def.sampleRows];
      }
    }

    const multiReport = await this.commitMultiTabSync(multiTabData, ['PRODUCTS'], user, sheetId);

    return {
      id: multiReport.id,
      timestamp: multiReport.timestamp,
      userEmail: multiReport.userEmail,
      sheetId,
      sheetName,
      durationMs: Date.now() - startTime,
      status: multiReport.status,
      counts: {
        totalProcessed: multiReport.totalRecords,
        newRecords: multiReport.createdTotal,
        updatedRecords: multiReport.updatedTotal,
        unchangedRecords: multiReport.unchangedTotal,
        removedRecords: 0,
        errorsCount: multiReport.errorsTotal
      },
      fieldChanges: [],
      validationErrors: multiReport.validationErrors.map(e => ({
        rowNumber: e.rowNumber,
        field: e.field,
        value: e.value,
        error: e.error
      })),
      logs: multiReport.logs,
      multiTabReport: multiReport
    };
  }

  /**
   * Authoritative Module-Level Synchronization
   * Directly syncs all canonical tabs for one of the 4 major inventory domains:
   * 1. PRODUCTS: PRODUCTS, PRODUCT_PRICING, PRODUCT_CAPACITY
   * 2. HOTELS: HOTELS, HOTEL_ROOMS, HOTEL_MEAL_PLANS, HOTEL_RATES
   * 3. VISA_ANCILLARY: VISA, VISA_RATES, TRAVEL_PROTECTION, VIP_GROUND, CONNECTIVITY
   * 4. JAPAN_RAIL: RAIL_STATIONS, RAIL_ROUTES, RAIL_SERVICES, RAIL_FARES, RAIL_CLASS_RULES
   * 5. ALL: All canonical tabs
   */
  public async executeModuleSync(
    moduleType: 'PRODUCTS' | 'HOTELS' | 'VISA_ANCILLARY' | 'JAPAN_RAIL' | 'ALL',
    user?: User | null,
    overrideSheetUrlOrId?: string
  ): Promise<MultiTabSyncReport> {
    const db = AppDatabase.getInstance();
    const config = db.getMasterGoogleSheetConfig();

    let targetTabs: MasterSheetTabName[] = [];
    if (moduleType === 'PRODUCTS') {
      targetTabs = ['PRODUCTS', 'PRODUCT_PRICING', 'PRODUCT_CAPACITY'];
    } else if (moduleType === 'HOTELS') {
      targetTabs = ['HOTELS', 'HOTEL_ROOMS', 'HOTEL_MEAL_PLANS', 'HOTEL_RATES'];
    } else if (moduleType === 'VISA_ANCILLARY') {
      targetTabs = ['VISA', 'VISA_RATES', 'TRAVEL_PROTECTION', 'VIP_GROUND', 'CONNECTIVITY'];
    } else if (moduleType === 'JAPAN_RAIL') {
      targetTabs = ['RAIL_STATIONS', 'RAIL_ROUTES', 'RAIL_SERVICES', 'RAIL_FARES', 'RAIL_CLASS_RULES'];
    } else {
      targetTabs = [
        'REGIONS', 'DESTINATIONS', 'HUBS',
        'PRODUCTS', 'PRODUCT_PRICING', 'PRODUCT_CAPACITY',
        'HOTELS', 'HOTEL_ROOMS', 'HOTEL_MEAL_PLANS', 'HOTEL_RATES',
        'VISA', 'VISA_RATES', 'TRAVEL_PROTECTION', 'VIP_GROUND', 'CONNECTIVITY',
        'TRANSFER_ROUTES', 'TRANSFER_RATES',
        'PACKAGES', 'PACKAGE_ITEMS',
        'FX_RATES',
        'RAIL_STATIONS', 'RAIL_ROUTES', 'RAIL_SERVICES', 'RAIL_FARES', 'RAIL_CLASS_RULES'
      ];
    }

    let rawSheetId = overrideSheetUrlOrId?.trim();
    if (!rawSheetId) {
      if (moduleType === 'JAPAN_RAIL' && (config as any).japanRailSheetUrl) {
        rawSheetId = (config as any).japanRailSheetUrl;
      } else {
        rawSheetId = config.masterSpreadsheetId || '1C8I2TOnc_7_u07_G_Pz705yGg4Y6U5BPyY4t-rG9Hzo';
      }
    }

    // Extract clean ID if full Google Sheet URL provided
    const match = rawSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const cleanSheetId = match ? match[1] : rawSheetId;

    const multiTabData: RawMultiTabData = {};

    for (const tabName of targetTabs) {
      const def = getTabSchemaByName(tabName);
      if (!def) continue;

      let rows: string[][] | null = null;
      if (cleanSheetId && !cleanSheetId.includes(' ')) {
        try {
          rows = await this.fetchRemoteWorksheet(cleanSheetId, tabName);
        } catch (e) {
          // fallback to sample
        }
      }

      if (rows && rows.length > 1) {
        multiTabData[tabName] = rows;
      } else {
        // Fallback to canonical dataset
        multiTabData[tabName] = [def.columns.map(c => c.name), ...def.sampleRows];
      }
    }

    return this.commitMultiTabSync(multiTabData, targetTabs, user, cleanSheetId);
  }

  // ----------------------------------------------------
  // DYNAMIC MODULE PRESET METHODS
  // ----------------------------------------------------

  /**
   * Inspects a workbook (raw data or list of tab names) against a specific Module Preset.
   */
  public inspectWorkbookAgainstPreset(
    input: string[] | RawMultiTabData,
    presetId: DynamicModulePresetId
  ): DynamicWorkbookInspectionReport {
    const preset = ModulePresetRegistry.getPreset(presetId);
    const presetName = preset ? preset.name : 'Canonical Module';
    const schemaVersion = preset ? preset.schemaVersion : 'v1.0.0';
    const requiredSchemas = ModulePresetRegistry.getSchemasForPreset(presetId, false);
    const requiredCanonicalTabs = requiredSchemas.map(s => s.canonicalTabName);

    // Normalize discovered sheet names and raw rows
    let discoveredNames: string[] = [];
    let dataMap: RawMultiTabData = {};

    if (Array.isArray(input)) {
      discoveredNames = input.filter(Boolean);
    } else {
      discoveredNames = Object.keys(input).filter(Boolean);
      dataMap = input;
    }

    const foundCanonicalTabs: string[] = [];
    const matchedSchemas: DynamicWorkbookInspectionReport['matchedSchemas'] = [];
    const unexpectedTabs: string[] = [];

    for (const rawName of discoveredNames) {
      const schema = CanonicalSchemaRegistry.findSchemaBySheetName(rawName);
      if (schema) {
        if (!foundCanonicalTabs.includes(schema.canonicalTabName)) {
          foundCanonicalTabs.push(schema.canonicalTabName);
        }

        const rawRows = dataMap[rawName];
        let totalRows = 0;
        let discoveredColumns: string[] = [];
        const missingRequiredColumns: string[] = [];
        const unexpectedColumns: string[] = [];

        if (Array.isArray(rawRows) && rawRows.length > 0) {
          totalRows = Math.max(0, rawRows.length - 1);
          const headerRow = Array.isArray(rawRows[0])
            ? (rawRows[0] as string[])
            : Object.keys(rawRows[0] || {});
          
          discoveredColumns = headerRow.map(h => String(h || '').trim());
          const normalizedDiscovered = new Set(
            discoveredColumns.map(c => c.toLowerCase().replace(/[\s_-]+/g, '_'))
          );

          // Check required schema columns
          for (const col of schema.columns) {
            const colKeyNorm = col.key.toLowerCase().replace(/[\s_-]+/g, '_');
            const colNameNorm = col.name.toLowerCase().replace(/[\s_-]+/g, '_');
            if (col.required) {
              if (!normalizedDiscovered.has(colKeyNorm) && !normalizedDiscovered.has(colNameNorm)) {
                missingRequiredColumns.push(col.key);
              }
            }
          }

          // Check unexpected columns
          const schemaKeys = new Set(
            schema.columns.flatMap(c => [
              c.key.toLowerCase().replace(/[\s_-]+/g, '_'),
              c.name.toLowerCase().replace(/[\s_-]+/g, '_')
            ])
          );

          for (const col of discoveredColumns) {
            const norm = col.toLowerCase().replace(/[\s_-]+/g, '_');
            if (!schemaKeys.has(norm) && !norm.startsWith('_') && norm.length > 0) {
              unexpectedColumns.push(col);
            }
          }
        }

        const isRequiredInPreset = preset?.requiredSchemaIds.includes(schema.schemaId);
        let status: 'READY' | 'WARNING' | 'BLOCKED' = 'READY';
        if (missingRequiredColumns.length > 0) {
          status = 'BLOCKED';
        } else if (unexpectedColumns.length > 0) {
          status = 'WARNING';
        }

        matchedSchemas.push({
          schemaId: schema.schemaId,
          canonicalTabName: schema.canonicalTabName,
          matchedSheetName: rawName,
          totalRows,
          discoveredColumns,
          missingRequiredColumns,
          unexpectedColumns,
          status
        });
      } else {
        unexpectedTabs.push(rawName);
      }
    }

    const missingTabs = requiredCanonicalTabs.filter(req => !foundCanonicalTabs.includes(req));
    const isBlocked = matchedSchemas.some(m => m.status === 'BLOCKED');
    const isValid = missingTabs.length === 0 && !isBlocked;

    let errorMessage: string | undefined;
    if (!isValid) {
      if (missingTabs.length > 0) {
        errorMessage = `Missing ${missingTabs.length} required tab(s) for ${presetName}: [${missingTabs.join(', ')}].`;
      } else if (isBlocked) {
        const blockedTabs = matchedSchemas.filter(m => m.status === 'BLOCKED').map(m => m.matchedSheetName);
        errorMessage = `Schema validation failed: Missing required columns in [${blockedTabs.join(', ')}].`;
      }
    }

    return {
      presetId,
      presetName,
      schemaVersion,
      isValid,
      requiredTabs: requiredCanonicalTabs,
      foundTabs: foundCanonicalTabs,
      missingTabs,
      unexpectedTabs,
      matchedSchemas,
      errorMessage
    };
  }

  /**
   * Validates hierarchical data specifically for a given preset.
   */
  public validateHierarchicalDataForPreset(
    multiTabData: RawMultiTabData,
    presetId: DynamicModulePresetId
  ): HierarchicalValidationReport {
    // Normalise incoming tab data
    const standardData: RawMultiTabData = {};
    for (const [rawTabName, data] of Object.entries(multiTabData)) {
      const schema = CanonicalSchemaRegistry.findSchemaBySheetName(rawTabName);
      const standardName = schema ? schema.canonicalTabName : rawTabName;
      standardData[standardName] = data;
    }

    // Run underlying validation engine
    return this.validateHierarchicalData(standardData);
  }

  /**
   * Generates a preview diff for a given preset.
   */
  public generateSyncPreviewForPreset(
    multiTabData: RawMultiTabData,
    presetId: DynamicModulePresetId
  ): Record<string, SyncPreviewTabDiff> {
    const schemas = ModulePresetRegistry.getSchemasForPreset(presetId, true);
    const targetTabs = schemas.map(s => s.canonicalTabName as MasterSheetTabName);

    // Map input tabs to canonical names
    const canonicalMultiTab: RawMultiTabData = {};
    for (const [rawName, data] of Object.entries(multiTabData)) {
      const schema = CanonicalSchemaRegistry.findSchemaBySheetName(rawName);
      const tabName = schema ? schema.canonicalTabName : rawName;
      canonicalMultiTab[tabName] = data;
    }

    return this.generateSyncPreview(canonicalMultiTab, targetTabs);
  }

  /**
   * Commits synchronization for a specific preset safely into the database.
   */
  public async commitPresetSync(
    multiTabData: RawMultiTabData,
    presetId: DynamicModulePresetId,
    user: User | null,
    sheetId: string,
    sheetName?: string,
    selectedTabNames?: string[]
  ): Promise<MultiTabSyncReport> {
    const preset = ModulePresetRegistry.getPreset(presetId);
    const presetName = preset ? preset.name : 'Canonical Module';
    const schemas = ModulePresetRegistry.getSchemasForPreset(presetId, true);
    
    let targetTabs = schemas.map(s => s.canonicalTabName as MasterSheetTabName);
    if (selectedTabNames && selectedTabNames.length > 0) {
      targetTabs = targetTabs.filter(t => selectedTabNames.includes(t));
    }

    // Normalise tab names to canonical names
    const canonicalMultiTab: RawMultiTabData = {};
    for (const [rawName, data] of Object.entries(multiTabData)) {
      const schema = CanonicalSchemaRegistry.findSchemaBySheetName(rawName);
      const tabName = (schema ? schema.canonicalTabName : rawName) as MasterSheetTabName;
      canonicalMultiTab[tabName] = data;
    }

    const report = await this.commitMultiTabSync(
      canonicalMultiTab,
      targetTabs,
      user,
      sheetId
    );

    // Augment report with Preset metadata
    report.presetId = presetId;
    report.presetName = presetName;
    report.syncMode = 'PRESET_SYNC';

    // Invalidate caches & recalculate all system counts
    countingEngine.recalculateAllCounts();

    // Persist updated report with preset info
    AppDatabase.getInstance().saveMultiTabSyncReport(report);

    return report;
  }
}

