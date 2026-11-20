import { AppDatabase } from '../services/db';
import { MasterDataService } from '../services/masterDataService';
import { countingEngine } from '../services/countingEngine';
import { inventoryDiscoveryService } from '../services/inventoryDiscoveryService';
import { queryLocalMarginGovernanceCatalog } from '../services/marginGovernanceService';
import { railPricingEngine } from '../services/railPricingEngine';
import {
  hydrateRailGeographyState,
  toggleRailRegionSelection,
  selectAllRailRegionsSelection,
  clearAllRailRegionsSelection,
  toggleRailHubSelection,
  selectAllRailHubsSelection,
  clearAllRailHubsSelection
} from '../components/AdminCMS/RailGeographySelector';
import { masterDataCache } from '../services/masterDataCache';
import { Product, User } from '../types';
import { INITIAL_RAIL_STATIONS } from '../data/initialRailStations';
import { INITIAL_RAIL_ROUTES } from '../data/initialRailRoutes';
import { INITIAL_RAIL_RATES } from '../data/initialRailRates';
import { INITIAL_RAIL_SEASON_CALENDAR } from '../data/initialRailSeasons';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRailMultiRegionHubAudit() {
  console.log('================================================================');
  console.log('  RAIL MULTI-REGION & MULTI-HUB ACCEPTANCE AUDIT');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();
  const masterData = MasterDataService.getInstance();
  await db.hydrateFromFirestoreNow();

  const adminUser: User = {
    id: 'usr-admin-rail-geo-test',
    name: 'Admin Tester',
    email: 'admin@theunbound.in',
    role: 'ADMIN',
    agencyName: 'TheUnbound DMC',
    createdAt: new Date().toISOString()
  };

  // Snapshot local storage & stub Firestore network writes so production Firestore is NEVER modified
  const dbAny = db as any;
  const originalProductsRaw = dbAny.getItem('products', []) as Product[];
  const originalRailCommRaw = dbAny.getItem('japan_rail_commercial_products', []) as any[];
  const originalRailStationsRaw = dbAny.getItem('rail_stations', []) as any[];
  const originalRailRoutesRaw = dbAny.getItem('rail_routes', []) as any[];
  const originalRailRatesRaw = dbAny.getItem('rail_rates', []) as any[];
  const originalRailSeasonsRaw = dbAny.getItem('rail_seasons', []) as any[];
  const originalSyncFirestoreDoc = dbAny.syncFirestoreDoc;
  const originalSyncFirestoreDelete = dbAny.syncFirestoreDelete;
  const originalLogAudit = dbAny.logAudit;
  dbAny.syncFirestoreDoc = () => {};
  dbAny.syncFirestoreDelete = () => {};
  dbAny.logAudit = () => {};

  if (db.getRailStations().length === 0) dbAny.setItem('rail_stations', INITIAL_RAIL_STATIONS, false);
  if (db.getRailRoutes().length === 0) dbAny.setItem('rail_routes', INITIAL_RAIL_ROUTES, false);
  if (db.getRailRates().length === 0) dbAny.setItem('rail_rates', INITIAL_RAIL_RATES, false);
  if (db.getRailSeasons().length === 0) dbAny.setItem('rail_seasons', INITIAL_RAIL_SEASON_CALENDAR, false);

  try {
    const jpnRegions = masterData.getRegionsByDestinationId('DST-JPN');
    const jpnHubs = masterData.getHubsByDestinationId('DST-JPN', false);

    assert(jpnRegions.length >= 5, `Authoritative Japan regions loaded dynamically (${jpnRegions.length})`);
    assert(jpnHubs.length >= 5, `Authoritative Japan hubs loaded dynamically (${jpnHubs.length})`);

    const kanto = jpnRegions.find(r => r.id === 'region-jp-kanto') || jpnRegions[0];
    const kansai = jpnRegions.find(r => r.id === 'region-jp-kansai') || jpnRegions[1];
    const chubu = jpnRegions.find(r => r.id === 'region-jp-chubu') || jpnRegions[2];
    const kyushu = jpnRegions.find(r => r.id === 'region-jp-kyushu') || jpnRegions[3];

    const tokyo = jpnHubs.find(h => h.id === 'hub-tokyo') || jpnHubs.find(h => h.regionId === kanto.id)!;
    const kyoto = jpnHubs.find(h => h.id === 'hub-kyoto') || jpnHubs.find(h => h.regionId === kansai.id)!;
    const osaka = jpnHubs.find(h => h.id === 'hub-osaka') || jpnHubs.find(h => h.regionId === kansai.id && h.id !== kyoto.id) || kyoto;
    const nagoya = jpnHubs.find(h => h.regionId === chubu.id);

    // ------------------------------------------------------------------
    // 1. UI State Helper Rules (Multi-Region + Grouped Multi-Hub + Guards)
    // ------------------------------------------------------------------
    console.log('\n--- 1. Rail Geography State & Dependency Rules ---');

    // Start with manual region Kansai selected (no hubs yet)
    let state = toggleRailRegionSelection({
      regionId: kansai.id,
      selectedRegionIds: [],
      selectedHubIds: [],
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(state.regionIds.length === 1 && state.regionIds[0] === kansai.id, 'Manual region Kansai added cleanly');

    // Check Tokyo hub (Kanto) -> must auto-add Kanto AND preserve manual Kansai
    state = toggleRailHubSelection({
      hubId: tokyo.id,
      selectedHubIds: state.hubIds,
      selectedRegionIds: state.regionIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(state.hubIds.includes(tokyo.id), 'Tokyo hub selected');
    assert(state.regionIds.includes(kanto.id), 'Checking Tokyo hub auto-added Kanto region');
    assert(state.regionIds.includes(kansai.id), 'Existing manual Kansai region preserved when adding Tokyo hub');

    // Check Kyoto + Osaka hubs (both in Kansai) -> no duplicate Kansai region ID
    state = toggleRailHubSelection({
      hubId: kyoto.id,
      selectedHubIds: state.hubIds,
      selectedRegionIds: state.regionIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    state = toggleRailHubSelection({
      hubId: osaka.id,
      selectedHubIds: state.hubIds,
      selectedRegionIds: state.regionIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(
      state.regionIds.filter(r => r === kansai.id).length === 1,
      'Selecting multiple hubs in Kansai does not duplicate regionId'
    );
    assert(
      state.regionNames.filter(n => n === kansai.name).length === 1,
      'Selecting multiple hubs in Kansai does not duplicate regionName'
    );

    // Manually add Chubu (no Chubu hub selected)
    state = toggleRailRegionSelection({
      regionId: chubu.id,
      selectedRegionIds: state.regionIds,
      selectedHubIds: state.hubIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(state.regionIds.includes(chubu.id), 'Manual region Chubu added alongside hub-linked regions');

    // Attempt to uncheck Kanto while Tokyo hub is selected -> MUST BE BLOCKED with warning
    const blockedRemove = toggleRailRegionSelection({
      regionId: kanto.id,
      selectedRegionIds: state.regionIds,
      selectedHubIds: state.hubIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(blockedRemove.blocked === true, 'Removing hub-required region Kanto is blocked');
    assert(blockedRemove.regionIds.includes(kanto.id), 'Kanto remains in regionIds after blocked removal');
    assert(
      Boolean(blockedRemove.warning && blockedRemove.warning.includes(tokyo.name)),
      `Blocked removal provides warning naming dependent hub (${tokyo.name})`
    );

    // Attempt Clear All regions while hubs are selected -> clears manual Chubu, retains Kanto & Kansai with warning
    const clearPartial = clearAllRailRegionsSelection({
      selectedRegionIds: state.regionIds,
      selectedHubIds: state.hubIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(clearPartial.blocked === true, 'Clear All regions warns when hub-required regions remain');
    assert(!clearPartial.regionIds.includes(chubu.id), 'Clear All removes non-hub manual region (Chubu)');
    assert(
      clearPartial.regionIds.includes(kanto.id) && clearPartial.regionIds.includes(kansai.id),
      'Clear All preserves hub-required regions (Kanto, Kansai)'
    );

    // Re-add Chubu, then deselect Tokyo hub -> Kanto is NOT silently removed, then Kanto can be removed cleanly
    state = toggleRailRegionSelection({
      regionId: chubu.id,
      selectedRegionIds: clearPartial.regionIds,
      selectedHubIds: clearPartial.hubIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    state = toggleRailHubSelection({
      hubId: tokyo.id,
      selectedHubIds: state.hubIds,
      selectedRegionIds: state.regionIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(!state.hubIds.includes(tokyo.id), 'Tokyo hub deselected');
    assert(state.regionIds.includes(kanto.id), 'Deselecting Tokyo hub does not silently remove Kanto region');
    state = toggleRailRegionSelection({
      regionId: kanto.id,
      selectedRegionIds: state.regionIds,
      selectedHubIds: state.hubIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(!state.regionIds.includes(kanto.id), 'Kanto region removed cleanly once no Kanto hub is checked');

    // Select All Regions & Select All / Clear All Hubs
    const allRegsState = selectAllRailRegionsSelection({
      destinationRegions: jpnRegions,
      selectedHubIds: state.hubIds,
      cityHubs: jpnHubs
    });
    assert(allRegsState.regionIds.length === jpnRegions.length, 'Select All Regions selects every region in Japan');
    const allHubsState = selectAllRailHubsSelection({
      hubIdsToAdd: jpnHubs.map(h => h.id),
      selectedHubIds: [],
      selectedRegionIds: [chubu.id],
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(allHubsState.hubIds.length === jpnHubs.length, 'Select All Hubs selects all Japan hubs');
    assert(allHubsState.regionIds.includes(chubu.id), 'Select All Hubs preserves manual regions');
    const clearedHubsState = clearAllRailHubsSelection({
      selectedRegionIds: allHubsState.regionIds,
      destinationRegions: jpnRegions,
      cityHubs: jpnHubs
    });
    assert(clearedHubsState.hubIds.length === 0, 'Clear All Hubs clears all selected hubs');
    assert(clearedHubsState.regionIds.length === allHubsState.regionIds.length, 'Clear All Hubs preserves valid selected regions');

    // ------------------------------------------------------------------
    // 2. Hierarchy Validation & Cross-Destination Rejection
    // ------------------------------------------------------------------
    console.log('\n--- 2. Hierarchy Validation & Cross-Destination Rejection ---');

    const validMulti = masterData.validateHierarchy(
      kanto.id,
      'DST-JPN',
      tokyo.id,
      [tokyo.id, kyoto.id, osaka.id],
      [kanto.id, kansai.id, chubu.id]
    );
    assert(validMulti.valid === true, 'validateHierarchy accepts multi-region + multi-hub Rail configuration (including manual Chubu)');

    const missingHubRegion = masterData.validateHierarchy(
      kanto.id,
      'DST-JPN',
      tokyo.id,
      [tokyo.id, kyoto.id],
      [kanto.id] // Missing kansai.id required by kyoto.id!
    );
    assert(missingHubRegion.valid === false && missingHubRegion.code === 'HUB_REGION_MISMATCH', 'validateHierarchy rejects hub whose region is missing from regionIds');

    const ukRegions = masterData.getRegionsByDestinationId('DST-UK');
    if (ukRegions.length > 0) {
      const crossDest = masterData.validateHierarchy(
        kanto.id,
        'DST-JPN',
        tokyo.id,
        [tokyo.id],
        [kanto.id, ukRegions[0].id]
      );
      assert(crossDest.valid === false && crossDest.code === 'DESTINATION_REGION_MISMATCH', 'validateHierarchy rejects cross-destination regionId');
    }

    // ------------------------------------------------------------------
    // 3. Persistence, Update, Reload & Legacy Backward Compatibility
    // ------------------------------------------------------------------
    console.log('\n--- 3. Persistence, Update, Reload & Legacy Compatibility ---');

    const testRailId = 'prod-rail-multiregion-audit-test';
    const createdMultiRail = db.saveProduct({
      id: testRailId,
      sku: 'JP-RAIL-MULTI-AUDIT',
      name: 'Japan Multi-Region Shinkansen Pass (Test)',
      title: 'Japan Multi-Region Shinkansen Pass (Test)',
      shortDescription: 'Multi-region & multi-hub bullet train test product',
      longDescription: 'Covers Kanto, Kansai, and Chubu regions',
      category: 'Rail',
      subcategory: 'High-Speed Rail',
      productType: 'Rail',
      destinationId: 'DST-JPN',
      destinationName: 'Japan',
      regionId: kanto.id,
      regionName: kanto.name,
      regionIds: [kanto.id, kansai.id, chubu.id],
      hubId: tokyo.id,
      hubIds: [tokyo.id, kyoto.id, osaka.id],
      city: tokyo.name,
      country: 'Japan',
      supplierId: 'sup-jr-pass',
      supplierName: 'Japan Rail Group',
      supplierProductCode: 'JR-MULTI-TEST',
      duration: '1 Day',
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: '06:00 - 23:30',
      adultNetPrice: 14000,
      childNetPrice: 7000,
      infantNetPrice: 0,
      currency: 'JPY',
      nativeCurrency: 'JPY',
      defaultMarkupPercent: 12,
      b2bAgentMarkupPercent: 12,
      taxPercent: 10,
      commissionPercent: 0,
      serviceFeeFixed: 0,
      sellingPriceStartingFrom: 15680,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2027-12-31',
      minPax: 1,
      maxPax: 10,
      availability: 'INSTANT',
      bookingRequiredDays: 0,
      cancellationPolicy: 'Standard',
      inclusions: ['Reserved seat'],
      exclusions: [],
      importantInformation: [],
      status: 'ACTIVE'
    } as Product, adminUser);

    assert(createdMultiRail.regionIds?.length === 3, `Saved Rail product persists 3 regionIds (${createdMultiRail.regionIds?.join(', ')})`);
    assert(
      Boolean(createdMultiRail.regionNames?.includes(kanto.name) && createdMultiRail.regionNames?.includes(kansai.name) && createdMultiRail.regionNames?.includes(chubu.name)),
      `Saved Rail product persists all 3 regionNames (${createdMultiRail.regionNames?.join(', ')})`
    );
    assert(createdMultiRail.hubIds?.length === 3, `Saved Rail product persists 3 hubIds (${createdMultiRail.hubIds?.join(', ')})`);
    assert(
      Boolean(createdMultiRail.hubNames?.includes(tokyo.name) && createdMultiRail.hubNames?.includes(kyoto.name) && createdMultiRail.hubNames?.includes(osaka.name)),
      `Saved Rail product persists all 3 hubNames (${createdMultiRail.hubNames?.join(', ')})`
    );

    // Update Rail product to add Kyushu region + reload from fresh getProducts()
    db.saveProduct({
      ...createdMultiRail,
      regionIds: [kanto.id, kansai.id, chubu.id, kyushu.id]
    }, adminUser);
    masterDataCache.bumpAll();
    const reloaded = db.getProducts().find(p => p.id === testRailId);
    assert(Boolean(reloaded && reloaded.regionIds?.length === 4 && reloaded.regionIds.includes(kyushu.id)), 'Updated Rail product reloads with all 4 regions including Kyushu');

    const auditMulti = masterData.auditProductHierarchy(reloaded!);
    assert(auditMulti.valid === true, `auditProductHierarchy passes for multi-region Rail product (issues: ${auditMulti.issues.join('; ') || 'none'})`);

    // Edit form hydration preserves all 4 regions + 3 hubs
    const hydratedEdit = hydrateRailGeographyState(reloaded, jpnRegions, jpnHubs);
    assert(hydratedEdit.regionIds.length === 4 && hydratedEdit.hubIds.length === 3, 'hydrateRailGeographyState preserves all 4 regions & 3 hubs on edit');

    // Legacy single-region Rail product read compatibility (no regionIds/regionNames/hubNames in raw record)
    const legacyRailId = 'prod-rail-legacy-single-test';
    const rawWithLegacy = dbAny.getItem('products', []) as Product[];
    rawWithLegacy.push({
      ...createdMultiRail,
      id: legacyRailId,
      sku: 'JP-RAIL-LEGACY-SINGLE',
      name: 'Legacy Single Region Rail Product',
      regionId: kanto.id,
      regionName: kanto.name,
      regionIds: undefined,
      regionNames: undefined,
      hubId: tokyo.id,
      hubIds: undefined,
      hubNames: undefined,
      destinationIds: undefined,
      city: tokyo.name
    } as any);
    dbAny.setItem('products', rawWithLegacy, false);
    masterDataCache.bumpAll();

    const readLegacy = db.getProducts().find(p => p.id === legacyRailId);
    assert(
      Boolean(readLegacy && readLegacy.regionId === kanto.id && readLegacy.regionIds?.includes(kanto.id) && readLegacy.regionNames?.includes(kanto.name) && readLegacy.hubIds?.includes(tokyo.id) && readLegacy.hubNames?.includes(tokyo.name)),
      'Legacy single-region Rail product normalizes cleanly on read without breaking single-region fields'
    );

    // ------------------------------------------------------------------
    // 4. Discovery, Search, Filtering & Zero Duplicate Cards
    // ------------------------------------------------------------------
    console.log('\n--- 4. Discovery, Filtering & Zero Duplicate Cards ---');

    for (const reg of [kanto, kansai, chubu, kyushu]) {
      const regMatches = masterData.getProductsByRegionId(reg.id, false).filter(p => p.id === testRailId);
      assert(regMatches.length === 1, `MasterDataService.getProductsByRegionId(${reg.name}) finds product exactly once`);

      const discReg = inventoryDiscoveryService.searchProducts({
        destinationId: 'DST-JPN',
        regionId: reg.id,
        category: 'Rail',
        pageSize: 100
      });
      const discCount = discReg.items.filter(p => p.id === testRailId).length;
      assert(discCount === 1, `InventoryDiscoveryService(${reg.name}) discovers product exactly once (no duplicate cards)`);

      const countingMatch = countingEngine.matchesProductFilter(reloaded!, { regionId: reg.id, onlyPublished: false });
      assert(countingMatch === true, `CountingEngine matches multi-region Rail product for ${reg.name}`);

      const mgResult = queryLocalMarginGovernanceCatalog({ regionId: reg.id, pageSize: 100 });
      assert(mgResult.rows.filter(r => r.product.id === testRailId).length === 1, `MarginGovernance matches product once for ${reg.name}`);
    }

    for (const hub of [tokyo, kyoto, osaka]) {
      const hubMatches = masterData.getProductsByHubId(hub.id, false).filter(p => p.id === testRailId);
      assert(hubMatches.length === 1, `MasterDataService.getProductsByHubId(${hub.name}) finds product exactly once`);

      const discHub = inventoryDiscoveryService.searchProducts({
        destinationId: 'DST-JPN',
        hubId: hub.id,
        category: 'Rail',
        pageSize: 100
      });
      assert(discHub.items.filter(p => p.id === testRailId).length === 1, `InventoryDiscoveryService(${hub.name}) discovers product exactly once`);
    }

    // Combined multi-criteria search returns product ONCE (never duplicated across regions/hubs)
    const keywordSearch = inventoryDiscoveryService.searchProducts({
      destinationId: 'DST-JPN',
      searchQuery: chubu.name,
      category: 'Rail',
      pageSize: 100
    });
    assert(
      keywordSearch.items.filter(p => p.id === testRailId).length === 1,
      `Searching by manual region name ("${chubu.name}") finds Rail product once without duplication`
    );

    // ------------------------------------------------------------------
    // 5. Non-Rail Regression Check & Rail Pricing Unchanged
    // ------------------------------------------------------------------
    console.log('\n--- 5. Non-Rail Integrity & Rail Pricing Regression Checks ---');

    const invalidNonRail = masterData.validateHierarchy(kanto.id, 'DST-JPN', kyoto.id);
    assert(invalidNonRail.valid === false, 'Non-Rail single-region validation still rejects Kanto + Kyoto mismatch');

    if (nagoya) {
      assert(nagoya.regionId === chubu.id, 'Chubu hub belongs strictly to Chubu');
    }

    const sampleFareCalc = railPricingEngine.calculatePrice({
      originStationId: 'JP-ST-TOKYO',
      destinationStationId: 'JP-ST-KYOTO',
      productId: 'RAIL-JP-ORD-RESERVED',
      serviceGroup: 'NOZOMI_MIZUHO',
      travelDate: '2026-06-15',
      adultsCount: 2,
      childrenCount: 0,
      targetCurrency: 'JPY'
    });
    assert(
      sampleFareCalc.isPriceAvailable === true && sampleFareCalc.finalSellingPriceTargetCurrency > 0,
      `RailPricingEngine calculates Shinkansen fares unchanged (${sampleFareCalc.finalSellingPriceTargetCurrency} JPY)`
    );

    console.log('\n================================================================');
    console.log(`  ALL ${passed} RAIL MULTI-REGION & MULTI-HUB CHECKS PASSED!`);
    console.log('================================================================\n');
  } finally {
    // Restore original storage and stubs cleanly
    dbAny.setItem('products', originalProductsRaw, false);
    dbAny.setItem('japan_rail_commercial_products', originalRailCommRaw, false);
    dbAny.setItem('rail_stations', originalRailStationsRaw, false);
    dbAny.setItem('rail_routes', originalRailRoutesRaw, false);
    dbAny.setItem('rail_rates', originalRailRatesRaw, false);
    dbAny.setItem('rail_seasons', originalRailSeasonsRaw, false);
    dbAny.syncFirestoreDoc = originalSyncFirestoreDoc;
    dbAny.syncFirestoreDelete = originalSyncFirestoreDelete;
    dbAny.logAudit = originalLogAudit;
    masterDataCache.bumpAll();
  }

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runRailMultiRegionHubAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
