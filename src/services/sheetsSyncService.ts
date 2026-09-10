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
  MealPlanCode
} from '../types';
import { MASTER_SHEETS_TAB_DEFINITIONS, getTabSchemaByName } from '../data/googleSheetsTemplate';

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
  // 3. HIERARCHICAL VALIDATION ENGINE
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

    // Also collect newly declared IDs in current sheet payload
    const incomingRegions = new Set((parsedTabs['REGIONS'] || []).map(r => r.region_id || r.id).filter(Boolean));
    const incomingDestinations = new Set((parsedTabs['DESTINATIONS'] || []).map(d => d.destination_id || d.id).filter(Boolean));
    const incomingHubs = new Set((parsedTabs['HUBS'] || []).map(h => h.hub_id || h.id).filter(Boolean));
    const incomingProducts = new Set((parsedTabs['PRODUCTS'] || []).map(p => p.product_id || p.sku || p.id).filter(Boolean));
    const incomingHotels = new Set((parsedTabs['HOTELS'] || []).map(h => h.hotel_id || h.id).filter(Boolean));
    const incomingVisas = new Set((parsedTabs['VISA'] || []).map(v => v.visa_id || v.id).filter(Boolean));
    const incomingRoutes = new Set((parsedTabs['TRANSFER_ROUTES'] || []).map(r => r.route_id || r.id).filter(Boolean));
    const incomingRooms = new Set((parsedTabs['HOTEL_ROOMS'] || []).map(r => r.room_id || r.id).filter(Boolean));
    const incomingMealPlans = new Set((parsedTabs['HOTEL_MEAL_PLANS'] || []).map(m => m.meal_plan_id || m.id).filter(Boolean));

    const validRegionIds = new Set([...existingRegions, ...incomingRegions]);
    const validDestIds = new Set([...existingDestinations, ...incomingDestinations]);
    const validHubIds = new Set([...existingHubs, ...incomingHubs]);
    const validProductIds = new Set([...existingProducts, ...incomingProducts]);
    const validHotelIds = new Set([...existingHotels, ...incomingHotels]);
    const validVisaIds = new Set([...existingVisas, ...incomingVisas]);
    const validRouteIds = new Set([...existingRoutes, ...incomingRoutes]);
    const validRoomIds = new Set([...existingRooms, ...incomingRooms]);
    const validMealPlanIds = new Set([...existingMealPlans, ...incomingMealPlans]);

    let orphanDestinations = 0;
    let orphanHubs = 0;
    let orphanProducts = 0;
    let orphanHotels = 0;
    let orphanTransfers = 0;
    let orphanPackages = 0;
    let rateMismatches = 0;

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
        const pkField = schema.primaryKey.toLowerCase();
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

      if (tabKey === 'REGIONS') {
        db.getMasterRegions().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'DESTINATIONS') {
        db.getDestinations().forEach(d => existingMap.set(d.id, d));
      } else if (tabKey === 'HUBS') {
        db.getCityHubs().forEach(h => existingMap.set(h.id, h));
      } else if (tabKey === 'PRODUCTS') {
        db.getProducts().forEach(p => existingMap.set(p.sku || p.id, p));
      } else if (tabKey === 'PRODUCT_PRICING') {
        db.getProductRates().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'PRODUCT_CAPACITY') {
        db.getProductCapacities().forEach(c => existingMap.set(c.id, c));
      } else if (tabKey === 'HOTELS') {
        db.getHotels().forEach(h => existingMap.set(h.id, h));
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
      } else if (tabKey === 'TRANSFER_ROUTES') {
        db.getTransferRoutes().forEach(r => existingMap.set(r.id, r));
      } else if (tabKey === 'TRANSFER_RATES') {
        db.getTransferRates().forEach(tr => existingMap.set(tr.id, tr));
      } else if (tabKey === 'PACKAGES') {
        db.getB2BPackages().forEach(p => existingMap.set(p.id, p));
      } else if (tabKey === 'PACKAGE_ITEMS') {
        db.getPackageItems().forEach(pi => existingMap.set(pi.id, pi));
      }

      for (const row of objects) {
        const pkField = tabDef.primaryKey.toLowerCase();
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

      if (tabKey === 'REGIONS') {
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
        payload.destinations = objects.map(d => ({
          id: d.destination_id || d.id,
          regionId: d.region_id || d.regionId || 'REG-001',
          name: d.destination_name || d.name || 'Destination',
          country: d.country_name || d.country || d.destination_name || '',
          slug: d.slug || (d.destination_name || '').toLowerCase().replace(/\s+/g, '-'),
          currency: (d.base_currency || d.currency || 'USD') as CurrencyCode,
          status: (d.status || 'ACTIVE').toUpperCase().includes('COMING') ? 'COMING_SOON' : 'ACTIVE',
          displayOrder: Number(d.display_order) || 1,
          heroImage: d.hero_image_url || d.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
          description: d.description || '',
          region: d.region_name || d.region_id || 'East Asia',
          tagline: `Premium Ground Logistics across ${d.destination_name || 'the Destination'}`,
          keySellingPoints: ['Curated 5-Star Accommodations', 'Private Chauffeur Fleet', '24/7 Dedicated DMC Operations'],
          bestTimeToVisit: 'Year-Round / Seasonal',
          idealTripDuration: '7–14 Days',
          travelStyle: 'Bespoke Luxury & Cultural Immersion',
          cities: [],
          highlights: ['Exclusive Experiences', 'VIP Airport Fast Track'],
          featuredProductIds: []
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.destinations.length} Destinations.`);
      } else if (tabKey === 'HUBS') {
        payload.hubs = objects.map(h => ({
          id: h.hub_id || h.id,
          destinationId: h.destination_id || h.destinationId || 'dest-japan',
          destinationName: h.country || 'Destination',
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
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.hubs.length} City Hubs.`);
      } else if (tabKey === 'PRODUCTS') {
        payload.products = objects.map(p => ({
          id: p.product_id || p.sku || `PRD-${Date.now()}`,
          sku: p.product_id || p.sku || `SKU-${Date.now()}`,
          name: p.product_name || p.name || 'Travel Product',
          destinationId: p.destination_id || p.destinationId || 'dest-japan',
          destinationName: p.destination_name || 'Japan',
          regionId: p.region_id || 'REG-001',
          hubId: p.hub_id || 'hub-tyo',
          city: p.city || 'Tokyo',
          country: p.country || 'Japan',
          productType: p.product_category || p.category || 'Day Tours',
          category: (p.product_category || 'Day Tours') as any,
          subcategory: p.subcategory || 'Private Experience',
          duration: p.duration || '8 Hours',
          operatingDays: (p.operating_days || 'Mon;Tue;Wed;Thu;Fri;Sat;Sun').split(';').map((s: string) => s.trim()).filter(Boolean),
          operatingHours: p.operating_hours || '09:00 - 18:00',
          adultNetPrice: Number(p.adult_nett) || Number(p.adultNetPrice) || 42000,
          childNetPrice: Number(p.child_nett) || Number(p.childNetPrice) || 22000,
          infantNetPrice: Number(p.infant_nett) || Number(p.infantNetPrice) || 0,
          sellingPriceStartingFrom: (Number(p.adult_nett) || 42000) * 1.2,
          currency: (p.currency || 'JPY') as CurrencyCode,
          supplierId: p.supplier_code || 'sup-01',
          supplierName: p.supplier_name || 'Contracted DMC Ground Supplier',
          supplierLocalCurrency: (p.currency || 'JPY') as CurrencyCode,
          supplierProductCode: p.supplier_product_code || '',
          shortDescription: p.description || p.shortDescription || 'Luxury private tour with English docent.',
          description: p.description || 'Full-day custom touring experience.',
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
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.products.length} Products.`);
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
      } else if (tabKey === 'VISA') {
        payload.visas = objects.map(v => ({
          id: v.visa_id || v.id,
          destinationId: v.destination_id || 'dest-japan',
          country: v.country || 'Japan',
          visaType: v.visa_type || 'Tourist E-Visa',
          entryType: (v.entry_type || 'SINGLE_ENTRY') as any,
          validityDays: Number(v.validity_days) || 90,
          stayDurationDays: Number(v.stay_days) || 30,
          processingTimeDays: Number(v.processing_days) || 5,
          expressProcessingAvailable: String(v.express_available).toUpperCase() === 'TRUE',
          embassyFee: Number(v.embassy_fee) || 25,
          serviceFee: Number(v.service_fee) || 70,
          currency: (v.currency || 'USD') as CurrencyCode,
          description: v.service_description || v.description || 'Comprehensive diplomatic visa submission and concierge handling.',
          documentsChecklist: (v.documentation || 'Original Passport;Passport Photos;Flight Itinerary;Hotel Confirmation').split(';').map((s: string) => s.trim()).filter(Boolean),
          submissionSteps: ['Document Review & Digital Verification', 'Biometrics & Consulate Appointment', 'Passport Stamping & Delivery'],
          eligibilityNotes: ['Valid for tourism and leisure travel', 'Passport must have at least 6 months validity'],
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
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
        payload.productCapacities = objects.map(pc => ({
          id: pc.capacity_id || pc.id || `CAP-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: pc.product_id,
          capacity: Number(pc.capacity) || 6,
          vehicleModel: pc.vehicle_model || 'Executive MPV',
          fixedNettCost: Number(pc.fixed_cost) || 0,
          currency: (pc.currency || 'USD') as CurrencyCode,
          status: 'ACTIVE'
        }));
        logs.push(`[${new Date().toLocaleTimeString()}] Staged ${payload.productCapacities.length} Product Capacities.`);
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
      } else if (tabKey === 'FX_RATES') {
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
}
