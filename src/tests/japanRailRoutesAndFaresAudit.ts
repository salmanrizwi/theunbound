import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { AppDatabase } from '../services/db';
import { railPricingEngine } from '../services/railPricingEngine';
import { japanRailJourneyService } from '../services/rail/JapanRailJourneyService';
import { japanRailJourneyDataService } from '../services/rail/JapanRailJourneyDataService';
import { RailRate, resolveRailRateNettPrice } from '../types/rail';
import { User } from '../types';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: CheckResult[] = [];

function record(name: string, condition: boolean, detail: string) {
  results.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
  const tag = condition ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name} — ${detail}`);
}

const ADMIN_USER: User = {
  id: 'audit-admin-001',
  name: 'System Audit Admin',
  email: 'admin@theunbound.travel',
  role: 'ADMIN',
  companyName: 'TheUnbound DMC',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const B2B_USER: User = {
  id: 'audit-agent-001',
  name: 'B2B Partner Agent',
  email: 'agent@partner.travel',
  role: 'B2B_AGENT',
  companyName: 'Partner Travel Agency',
  createdAt: '2026-01-01T00:00:00.000Z'
};

async function hydrateAppDatabaseFromLiveFirestore() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const firestore = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

  const db = AppDatabase.getInstance() as any;

  const loadCollection = async (name: string) => {
    const snap = await getDocs(collection(firestore, name));
    return snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
  };

  const [
    stations,
    routes,
    rates,
    seasons,
    markupRules,
    commercialProducts,
    products
  ] = await Promise.all([
    loadCollection('rail_stations'),
    loadCollection('rail_routes'),
    loadCollection('rail_rates'),
    loadCollection('rail_seasons'),
    loadCollection('rail_markup_rules'),
    loadCollection('japan_rail_commercial_products'),
    loadCollection('products')
  ]);

  if (stations.length > 0) db.setItem('rail_stations', stations);
  if (routes.length > 0) db.setItem('rail_routes', routes);
  if (rates.length > 0) db.setItem('rail_rates', rates);
  if (seasons.length > 0) db.setItem('rail_seasons', seasons);
  if (markupRules.length > 0) db.setItem('rail_markup_rules', markupRules);
  if (commercialProducts.length > 0) db.setItem('japan_rail_commercial_products', commercialProducts);
  if (products.length > 0) db.setItem('products', products);

  return {
    firestore,
    db: AppDatabase.getInstance(),
    counts: { stations: stations.length, routes: routes.length, rates: rates.length, seasons: seasons.length }
  };
}

async function main() {
  console.log('=== JAPAN RAIL ROUTES & FARES LIVE AUDIT ===\n');
  const { firestore, db, counts } = await hydrateAppDatabaseFromLiveFirestore();
  console.log(`Hydrated from live Firestore: stations=${counts.stations}, routes=${counts.routes}, rates=${counts.rates}, seasons=${counts.seasons}\n`);

  // 1. Stations & Preserved Rates
  const stations = db.getRailStations();
  const tokyoSt = stations.find(s => s.stationId === 'JP-ST-TOKYO');
  const naganoSt = stations.find(s => s.stationId === 'JP-ST-NAGANO');
  record(
    '1. Tokyo & Nagano Stations Active',
    Boolean(tokyoSt?.active && naganoSt?.active),
    `Tokyo=${tokyoSt?.stationCode} (active=${tokyoSt?.active}), Nagano=${naganoSt?.stationCode} (active=${naganoSt?.active})`
  );

  const rates = db.getRailRates();
  const ordRate = rates.find(r => r.rateId === 'JP-RR-387675');
  const grnRate = rates.find(r => r.rateId === 'JP-RR-451756');
  record(
    '2. Configured Tokyo-Nagano Rates Preserved',
    Boolean(
      ordRate?.active && resolveRailRateNettPrice(ordRate) === 8573 &&
      grnRate?.active && resolveRailRateNettPrice(grnRate) === 12172
    ),
    `Ordinary=${ordRate?.rateId} (¥${ordRate ? resolveRailRateNettPrice(ordRate) : 'missing'}), Green=${grnRate?.rateId} (¥${grnRate ? resolveRailRateNettPrice(grnRate) : 'missing'})`
  );

  // 3. Authoritative Tokyo <-> Nagano Routes in Firestore
  const routes = db.getRailRoutes();
  const rtOut = routes.find(r => r.routeId === 'JP-RT-TOKYO-NAGANO');
  const rtRet = routes.find(r => r.routeId === 'JP-RT-NAGANO-TOKYO');
  const noFabrication =
    rtOut?.distanceKm === undefined &&
    rtRet?.distanceKm === undefined &&
    rtOut?.travelDurationMinutes === undefined &&
    rtRet?.travelDurationMinutes === undefined;
  record(
    '3. Tokyo <-> Nagano Routes Persisted Without Fabricated Distance/Duration',
    Boolean(rtOut?.active && rtRet?.active && noFabrication),
    `Outbound=${rtOut?.routeId} (${rtOut?.routeCode}), Return=${rtRet?.routeId} (${rtRet?.routeCode}), fabricatedMetrics=${!noFabrication}`
  );

  // 4. Duplicate Directional Route Rejection
  let dupRejected = false;
  let dupHasExisting = false;
  try {
    await db.saveRailRouteAsync(
      {
        routeId: 'JP-RT-TOKYO-NAGANO-DUP',
        originStationId: 'JP-ST-TOKYO',
        destinationStationId: 'JP-ST-NAGANO',
        originStationName: 'Tokyo',
        destinationStationName: 'Nagano',
        country: 'Japan',
        destinationId: 'dest-japan',
        railOperator: 'JR East',
        availableProductIds: ['RAIL-JP-ORD-RESERVED', 'RAIL-JP-GREEN-RESERVED'],
        availableServiceGroups: ['NOZOMI_MIZUHO'],
        active: true
      },
      ADMIN_USER
    );
  } catch (err: any) {
    dupRejected = true;
    dupHasExisting = Boolean(err?.existingRoute?.routeId === 'JP-RT-TOKYO-NAGANO');
  }
  record(
    '4. Duplicate Directional Route Blocked',
    dupRejected && dupHasExisting,
    `rejected=${dupRejected}, existingRouteReturned=${dupHasExisting}`
  );

  // 5. Same-Station Validation Rejection
  let sameRejected = false;
  try {
    await db.saveRailRouteAsync(
      {
        routeId: 'JP-RT-TOKYO-TOKYO',
        originStationId: 'JP-ST-TOKYO',
        destinationStationId: 'JP-ST-TOKYO',
        originStationName: 'Tokyo',
        destinationStationName: 'Tokyo',
        country: 'Japan',
        destinationId: 'dest-japan',
        railOperator: 'JR East',
        availableProductIds: ['RAIL-JP-ORD-RESERVED'],
        availableServiceGroups: ['NOZOMI_MIZUHO'],
        active: true
      },
      ADMIN_USER
    );
  } catch {
    sameRejected = true;
  }
  record('5. Same-Station Route Blocked', sameRejected, `rejected=${sameRejected}`);

  // 6. RBAC Non-Admin Rejection
  let rbacRejected = false;
  try {
    await db.saveRailRouteAsync(
      {
        routeId: 'JP-RT-AUDIT-RBAC-TEST',
        originStationId: 'JP-ST-NAGANO',
        destinationStationId: 'JP-ST-KYOTO',
        originStationName: 'Nagano',
        destinationStationName: 'Kyoto',
        country: 'Japan',
        destinationId: 'dest-japan',
        railOperator: 'JR East / JR Central',
        availableProductIds: ['RAIL-JP-ORD-RESERVED'],
        availableServiceGroups: ['NOZOMI_MIZUHO'],
        active: true
      },
      B2B_USER
    );
  } catch {
    rbacRejected = true;
  }
  record('6. Non-Admin Route Write Blocked (RBAC)', rbacRejected, `rejected=${rbacRejected}`);

  // 7. Live Cross-Region Route CRUD Lifecycle (Create -> Read-back -> Edit -> Deactivate -> Pricing Engine Check -> Cleanup)
  const tempRouteId = 'JP-RT-AUDIT-NGN-KYO-TEMP';
  // Clean up any leftover temp doc from a previously interrupted run
  await db.deleteRailRouteAsync(tempRouteId, ADMIN_USER).catch(() => {});
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(firestore, 'rail_routes', tempRouteId)).catch(() => {});
  // Clear tombstone for tempRouteId so fresh creation works cleanly
  const deletedEntities = (db as any).getItem?.('deleted_entities', []) || [];
  if (Array.isArray(deletedEntities)) {
    (db as any).setItem('deleted_entities', deletedEntities.filter((e: any) => !String(e?.id || e).includes(tempRouteId)));
  }
  try {
    const created = await db.saveRailRouteAsync(
      {
        routeId: tempRouteId,
        routeCode: 'NGN-KYO',
        originStationId: 'JP-ST-NAGANO',
        destinationStationId: 'JP-ST-KYOTO',
        originStationName: 'Nagano',
        destinationStationName: 'Kyoto',
        country: 'Japan',
        destinationId: 'dest-japan',
        railOperator: 'JR East / JR Central',
        availableProductIds: ['RAIL-JP-ORD-RESERVED', 'RAIL-JP-GREEN-RESERVED'],
        availableServiceGroups: ['NOZOMI_MIZUHO', 'HIKARI_KODAMA_SAKURA_TSUBAME'],
        active: true
      },
      ADMIN_USER
    );
    const snapCreated = await getDoc(doc(firestore, 'rail_routes', tempRouteId));
    const edited = await db.saveRailRouteAsync(
      { ...created, notes: 'Cross-region audit verified', active: false },
      ADMIN_USER
    );
    const inactiveCheck = railPricingEngine.calculatePrice({
      originStationId: 'JP-ST-NAGANO',
      destinationStationId: 'JP-ST-KYOTO',
      productId: 'RAIL-JP-ORD-RESERVED',
      serviceGroup: 'NOZOMI_MIZUHO',
      travelDate: '2026-12-10',
      adultsCount: 1,
      childrenCount: 0,
      userRole: 'B2B_AGENT',
      targetCurrency: 'JPY'
    });
    record(
      '7. Live Firestore Cross-Region Route Create / Edit / Deactivate Lifecycle',
      Boolean(
        snapCreated.exists() &&
        edited.active === false &&
        edited.notes === 'Cross-region audit verified' &&
        !inactiveCheck.isPriceAvailable &&
        inactiveCheck.diagnosticCode === 'INACTIVE_ROUTE'
      ),
      `firestoreExists=${snapCreated.exists()}, inactiveDiagnostic=${inactiveCheck.diagnosticCode}`
    );
  } finally {
    await db.deleteRailRouteAsync(tempRouteId, ADMIN_USER).catch(() => {});
    await deleteDoc(doc(firestore, 'rail_routes', tempRouteId)).catch(() => {});
  }

  // 8. Live Pricing Engine — Tokyo -> Nagano (Ordinary & Green)
  const testDate = '2026-12-10';
  const tyoNgnOrd = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-NAGANO',
    productId: 'RAIL-JP-ORD-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: testDate,
    adultsCount: 1,
    childrenCount: 0,
    userRole: 'B2B_AGENT',
    targetCurrency: 'JPY'
  });
  const tyoNgnGrn = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-NAGANO',
    productId: 'RAIL-JP-GREEN-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: testDate,
    adultsCount: 1,
    childrenCount: 0,
    userRole: 'B2B_AGENT',
    targetCurrency: 'JPY'
  });
  record(
    '8. Pricing Engine: Tokyo -> Nagano (Ordinary & Green)',
    Boolean(
      tyoNgnOrd.isPriceAvailable &&
      tyoNgnOrd.fareBreakdown.nettPriceTotalJPY === 8573 &&
      tyoNgnOrd.adultPerPaxSupplierJPY === 8373 &&
      tyoNgnOrd.finalSellingPriceJPY === 9380 &&
      tyoNgnOrd.routeId === 'JP-RT-TOKYO-NAGANO' &&
      tyoNgnOrd.adultRateId === 'JP-RR-387675' &&
      tyoNgnOrd.estimatedDurationMinutes === 0 &&
      tyoNgnOrd.formattedDuration === 'Schedule TBC' &&
      tyoNgnGrn.isPriceAvailable &&
      tyoNgnGrn.fareBreakdown.nettPriceTotalJPY === 12172 &&
      tyoNgnGrn.adultPerPaxSupplierJPY === 11972 &&
      tyoNgnGrn.finalSellingPriceJPY === 13410 &&
      tyoNgnGrn.adultRateId === 'JP-RR-451756'
    ),
    `Ordinary=¥${tyoNgnOrd.finalSellingPriceJPY} (nett=¥${tyoNgnOrd.fareBreakdown.nettPriceTotalJPY}, seasonAdj=¥${tyoNgnOrd.adultSeasonAdjustmentJPY}, rate=${tyoNgnOrd.adultRateId}, route=${tyoNgnOrd.routeId}, dur=${tyoNgnOrd.formattedDuration}), Green=¥${tyoNgnGrn.finalSellingPriceJPY} (nett=¥${tyoNgnGrn.fareBreakdown.nettPriceTotalJPY}, rate=${tyoNgnGrn.adultRateId})`
  );

  // 9. Live Pricing Engine — Nagano -> Tokyo (Return Direction)
  const ngnTyoOrd = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-NAGANO',
    destinationStationId: 'JP-ST-TOKYO',
    productId: 'RAIL-JP-ORD-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: testDate,
    adultsCount: 1,
    childrenCount: 0,
    userRole: 'B2B_AGENT',
    targetCurrency: 'JPY'
  });
  const ngnTyoGrn = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-NAGANO',
    destinationStationId: 'JP-ST-TOKYO',
    productId: 'RAIL-JP-GREEN-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: testDate,
    adultsCount: 1,
    childrenCount: 0,
    userRole: 'B2B_AGENT',
    targetCurrency: 'JPY'
  });
  record(
    '9. Pricing Engine: Nagano -> Tokyo (Ordinary & Green)',
    Boolean(
      ngnTyoOrd.isPriceAvailable &&
      ngnTyoOrd.finalSellingPriceJPY === 9380 &&
      ngnTyoOrd.routeId === 'JP-RT-NAGANO-TOKYO' &&
      ngnTyoOrd.routeMatchType === 'EXACT_DIRECTION' &&
      ngnTyoOrd.fareMatchType === 'SYMMETRIC_CORRIDOR' &&
      ngnTyoGrn.isPriceAvailable &&
      ngnTyoGrn.finalSellingPriceJPY === 13410
    ),
    `Ordinary=¥${ngnTyoOrd.finalSellingPriceJPY} (route=${ngnTyoOrd.routeId}/${ngnTyoOrd.routeMatchType}, fare=${ngnTyoOrd.fareMatchType}), Green=¥${ngnTyoGrn.finalSellingPriceJPY}`
  );

  // 10. Unconfigured Child Fare Fails Cleanly (No Fabrication)
  const childCheck = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-NAGANO',
    productId: 'RAIL-JP-ORD-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: testDate,
    adultsCount: 1,
    childrenCount: 1,
    userRole: 'B2B_AGENT',
    targetCurrency: 'JPY'
  });
  record(
    '10. Missing Child Fare Returns MISSING_FARE Without Fabrication',
    !childCheck.isPriceAvailable && childCheck.diagnosticCode === 'MISSING_FARE',
    `isPriceAvailable=${childCheck.isPriceAvailable}, diagnosticCode=${childCheck.diagnosticCode}`
  );

  // 11. Explicit Directional Fare Overrides Newer Opposite-Direction Fare (In-Memory Only)
  const internalDb = db as any;
  const originalRatesSnapshot = db.getRailRates();
  try {
    const returnOverrideRate: RailRate = {
      rateId: 'JP-RR-MEM-RETURN-TEST',
      routeId: 'JP-RT-NAGANO-TOKYO',
      originStationId: 'JP-ST-NAGANO',
      destinationStationId: 'JP-ST-TOKYO',
      productId: 'RAIL-JP-ORD-RESERVED',
      carType: 'Ordinary',
      seatType: 'Reserved',
      serviceGroup: 'NOZOMI_MIZUHO',
      passengerType: 'ADULT',
      nettPrice: 9000,
      nativeCurrency: 'JPY',
      currency: 'JPY',
      active: true,
      effectiveDate: '2026-01-01',
      supplierId: 'SUP-JR-EAST',
      supplierName: 'JR East',
      updatedAt: '2020-01-01T00:00:00.000Z'
    };
    internalDb.setItem('rail_rates', [...originalRatesSnapshot, returnOverrideRate]);
    const overrideRes = railPricingEngine.calculatePrice({
      originStationId: 'JP-ST-NAGANO',
      destinationStationId: 'JP-ST-TOKYO',
      productId: 'RAIL-JP-ORD-RESERVED',
      serviceGroup: 'NOZOMI_MIZUHO',
      travelDate: testDate,
      adultsCount: 1,
      childrenCount: 0,
      userRole: 'B2B_AGENT',
      targetCurrency: 'JPY'
    });
    record(
      '11. Explicit Return-Direction Fare Prioritized Over Newer Outbound Fare',
      overrideRes.isPriceAvailable && overrideRes.adultRateId === 'JP-RR-MEM-RETURN-TEST' && overrideRes.fareBreakdown.nettPriceTotalJPY === 9000 && overrideRes.fareMatchType === 'EXACT_DIRECTION',
      `rateId=${overrideRes.adultRateId}, nett=¥${overrideRes.fareBreakdown.nettPriceTotalJPY}, supplierAdj=¥${overrideRes.adultPerPaxSupplierJPY}, fareMatchType=${overrideRes.fareMatchType}`
    );
  } finally {
    internalDb.setItem('rail_rates', originalRatesSnapshot);
  }

  // 12. B2B Shinkansen Dynamic Journey Configurator Service & Quote Snapshot Flow
  const searchedNagano = japanRailJourneyDataService.searchStations('nagano');
  const searchedNgn = japanRailJourneyDataService.searchStations('ngn');
  let journey = japanRailJourneyService.createDefaultJourney({
    initialDate: testDate,
    passengers: { adults: 2, children: 0, infants: 0 },
    currency: 'JPY',
    portalOrigin: 'B2B_QUOTE_BUILDER',
    userRole: 'B2B_AGENT'
  });
  journey = japanRailJourneyService.updateSegment(
    journey,
    journey.segments[0].segmentId,
    {
      origin: japanRailJourneyDataService.getStationRef('JP-ST-TOKYO'),
      destination: japanRailJourneyDataService.getStationRef('JP-ST-NAGANO'),
      productId: 'RAIL-JP-ORD-RESERVED',
      serviceGroup: 'NOZOMI_MIZUHO',
      travelDate: testDate
    },
    'B2B_AGENT'
  );
  const outboundValid = Boolean(
    journey.validation.isValid &&
    journey.segments[0].pricing?.isPriceAvailable &&
    journey.segments[0].pricing?.finalSellingPriceJPY === 18760
  );

  // Add return segment Nagano -> Tokyo & test swap + quote snapshot preservation
  journey = japanRailJourneyService.addSegment(journey, 'B2B_AGENT');
  journey = japanRailJourneyService.updateSegment(
    journey,
    journey.segments[1].segmentId,
    {
      origin: japanRailJourneyDataService.getStationRef('JP-ST-NAGANO'),
      destination: japanRailJourneyDataService.getStationRef('JP-ST-TOKYO'),
      productId: 'RAIL-JP-ORD-RESERVED',
      serviceGroup: 'NOZOMI_MIZUHO',
      travelDate: testDate
    },
    'B2B_AGENT'
  );
  const roundTripValid = Boolean(
    journey.validation.isValid &&
    journey.segments.length === 2 &&
    journey.segments[1].origin.stationId === 'JP-ST-NAGANO' &&
    journey.segments[1].destination.stationId === 'JP-ST-TOKYO' &&
    journey.pricing.finalSellingPriceJPY === 37520
  );

  const quoteItem = japanRailJourneyService.convertToQuoteItem(journey, 1);
  const rehydrated = JSON.parse(JSON.stringify(quoteItem));
  const restored = japanRailJourneyService.restoreJourneyFromSnapshot(rehydrated.japanRailJourneySnapshot, 'B2B_AGENT');
  const snapshotIntact = Boolean(
    rehydrated.railJourneyDetails?.routeId === 'JP-RT-TOKYO-NAGANO' &&
    rehydrated.railJourneyDetails?.adultRateId === 'JP-RR-387675' &&
    rehydrated.japanRailJourneySnapshot?.segments?.length === 2 &&
    rehydrated.japanRailJourneySnapshot?.segments?.[0]?.routeId === 'JP-RT-TOKYO-NAGANO' &&
    rehydrated.japanRailJourneySnapshot?.segments?.[1]?.routeId === 'JP-RT-NAGANO-TOKYO' &&
    restored.segments.length === 2 &&
    restored.pricing.finalSellingPriceJPY === 37520 &&
    !String(rehydrated.notes || '').includes('Total Distance: 0 km')
  );

  record(
    '12. B2B Journey Configurator Service, Round-Trip & Quote Snapshot Preservation',
    Boolean(searchedNagano.some(s => s.stationId === 'JP-ST-NAGANO') && searchedNgn.some(s => s.stationId === 'JP-ST-NAGANO') && outboundValid && roundTripValid && snapshotIntact),
    `searchNagano=${searchedNagano.length}, outboundValid=${outboundValid} (¥${journey.segments[0].pricing?.finalSellingPriceJPY}), roundTripTotal=¥${journey.pricing.finalSellingPriceJPY}, snapshotIntact=${snapshotIntact}`
  );

  // 13. Regression Check: Tokyo <-> Kyoto
  const tyoKyo = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-KYOTO',
    productId: 'RAIL-JP-ORD-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: testDate,
    adultsCount: 1,
    childrenCount: 0,
    userRole: 'B2B_AGENT',
    targetCurrency: 'JPY'
  });
  const kyoTyo = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-KYOTO',
    destinationStationId: 'JP-ST-TOKYO',
    productId: 'RAIL-JP-ORD-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: testDate,
    adultsCount: 1,
    childrenCount: 0,
    userRole: 'B2B_AGENT',
    targetCurrency: 'JPY'
  });
  record(
    '13. Regression Check: Existing Tokyo <-> Kyoto Corridor',
    Boolean(tyoKyo.isPriceAvailable && kyoTyo.isPriceAvailable && tyoKyo.finalSellingPriceJPY > 0 && kyoTyo.finalSellingPriceJPY > 0),
    `Tokyo->Kyoto=¥${tyoKyo.finalSellingPriceJPY} (${tyoKyo.routeId}), Kyoto->Tokyo=¥${kyoTyo.finalSellingPriceJPY} (${kyoTyo.routeId})`
  );

  // 14. Final Live Firestore Integrity Verification
  const [finalRoutesSnap, finalRatesSnap] = await Promise.all([
    getDocs(collection(firestore, 'rail_routes')),
    getDocs(collection(firestore, 'rail_rates'))
  ]);
  const hasStrayTemp = finalRoutesSnap.docs.some(d => d.id === tempRouteId);
  if (finalRoutesSnap.size !== 29) {
    console.log('Current rail_routes IDs:', finalRoutesSnap.docs.map(d => d.id).sort().join(', '));
  }
  record(
    '14. Live Firestore Collection Integrity (Preserved Counts & Zero Stray Temp Docs)',
    finalRoutesSnap.size === 29 && finalRatesSnap.size === 18 && !hasStrayTemp,
    `rail_routes=${finalRoutesSnap.size} (expected 29), rail_rates=${finalRatesSnap.size} (expected 18), strayTemp=${hasStrayTemp}`
  );

  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} PASSED ===`);
  if (failed.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Audit script crashed:', err);
  process.exit(1);
});
