import { AppDatabase } from '../services/db';
import { parseRoute } from '../services/portalRouter';
import { resolveAncillaryTab } from '../components/AdminCMS/VisaCMSManager';
import { 
  TravelProtectionPlan, 
  VipGroundService, 
  ConnectivityPlan, 
  User 
} from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function runAudit() {
  console.log('===============================================================');
  console.log('VISA & ANCILLARY SERVICES — AUDIT & PERSISTENCE CERTIFICATION');
  console.log('===============================================================\n');

  const db = AppDatabase.getInstance();
  // Mock network Firestore round-trip for local CLI headless test environment
  db.syncFirestoreDocAsync = async (_col: string, _docId: string, _data: any) => true;
  db.deleteFirestoreDocAsync = async (col: string, docId: string, details?: any) => {
    db.markEntityDeleted(col, docId, details);
    return true;
  };

  const mockAdminUser: User = {
    id: 'usr-admin-test',
    email: 'business@theunbound.in',
    name: 'Admin Test',
    role: 'ADMIN',
    createdAt: new Date().toISOString()
  };

  // --------------------------------------------------------------------------
  // TEST SECTION 1: MASTER SCHEMA MATRIX REMOVAL & ROUTE GRACEFUL FALLBACK
  // --------------------------------------------------------------------------
  console.log('--- TEST SECTION 1: Master Schema Matrix Clean Retirement ---');
  
  // 1.1 resolveAncillaryTab rejects matrix and defaults to VISA_SERVICES
  const resolvedTab1 = resolveAncillaryTab('masterschemamatrix');
  assert(resolvedTab1 === 'VISA_SERVICES', 'resolveAncillaryTab routes masterschemamatrix to VISA_SERVICES');

  const resolvedTab2 = resolveAncillaryTab('fieldparity');
  assert(resolvedTab2 === 'VISA_SERVICES', 'resolveAncillaryTab routes fieldparity to VISA_SERVICES');

  const resolvedTab3 = resolveAncillaryTab('travelprotection');
  assert(resolvedTab3 === 'TRAVEL_PROTECTION', 'resolveAncillaryTab preserves travelprotection');

  const resolvedTab4 = resolveAncillaryTab('groundconnectivity');
  assert(resolvedTab4 === 'GROUND_CONNECTIVITY', 'resolveAncillaryTab preserves groundconnectivity');

  // 1.2 portalRouter maps matrix routes to visa_services without dead ends
  const route1 = parseRoute('/admin/operations/masterschemamatrix');
  assert(route1.subTab === 'visas-ancillary' && route1.param === 'visa_services', 
    '/admin/operations/masterschemamatrix redirects to visas-ancillary/visa_services');

  const route2 = parseRoute('/admin/masterschemamatrix');
  assert(route2.subTab === 'visas-ancillary' && route2.param === 'visa_services', 
    '/admin/masterschemamatrix aliases directly to visas-ancillary/visa_services');

  const route3 = parseRoute('/admin/visas-ancillary/field-parity');
  assert(route3.subTab === 'visas-ancillary' && route3.param === 'visa_services', 
    '/admin/visas-ancillary/field-parity cleanly normalizes to visa_services');

  const route4 = parseRoute('/b2b/visa/masterschemamatrix');
  assert(route4.namespace === 'B2B' && route4.param === 'ALL', 
    'B2B Agent route for masterschemamatrix does not expose matrix');

  // --------------------------------------------------------------------------
  // TEST SECTION 2: TRAVEL PROTECTION EDITING & LIFECYCLE PERSISTENCE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 2: Travel Protection Field Updates & Persistence ---');
  
  const existingProtectionPlans = db.getTravelProtectionPlans();
  assert(existingProtectionPlans.length > 0, `Travel Protection plans loaded (${existingProtectionPlans.length} records)`);

  const targetPlan = existingProtectionPlans[0];
  const originalPlanSnapshot = JSON.parse(JSON.stringify(targetPlan));
  const testId = targetPlan.id;

  // Modify all key fields
  const updatedPlan: TravelProtectionPlan = {
    ...targetPlan,
    serviceName: 'Comprehensive Elite Schengen & Global Protection Plan',
    provider: 'Allianz Global Care International',
    coverageArea: 'Worldwide incl. US/Canada & Schengen Zone',
    destinationId: 'dest-japan',
    medicalCoverageAmount: 750000,
    emergencyAssistanceIncluded: true,
    evacuationCoverageAmount: 350000,
    tripCancellationAmount: 15000,
    baggageLossAmount: 5000,
    validityDaysMax: 60,
    eligibilityAgeMin: 0,
    eligibilityAgeMax: 90,
    netCostPerTrip: 45,
    sellingPricePerTrip: 65,
    currency: 'USD',
    status: 'ACTIVE',
    terms: 'Complies fully with European Regulation (EC) No 810/2009. Minimum EUR 30,000 emergency medical and repatriation guarantee.',
    customerDescription: 'Top-tier consular compliant travel medical and evacuation coverage with zero-deductible cashless hospital network.',
    inclusions: [
      'Cashless In-Patient Hospitalization up to $750,000',
      'Emergency Air Medical Evacuation & Repatriation up to $350,000',
      'Trip Cancellation & Interruption Reimbursement up to $15,000',
      'Checked Baggage Loss & 6h+ Delay Compensation up to $5,000',
      '24/7 Global SOS Assistance Desk'
    ]
  };

  // Perform async save
  const savedResult = await db.saveTravelProtectionPlanAsync(updatedPlan, mockAdminUser);
  assert(savedResult.id === testId, 'Travel Protection updated record preserves original document ID');

  // Read back directly from database
  const readBackPlan = db.getTravelProtectionPlanById(testId);
  assert(!!readBackPlan, 'Travel Protection record successfully read back by ID');
  assert(readBackPlan?.serviceName === 'Comprehensive Elite Schengen & Global Protection Plan', 'serviceName persisted accurately');
  assert(readBackPlan?.provider === 'Allianz Global Care International', 'provider persisted accurately');
  assert(readBackPlan?.coverageArea === 'Worldwide incl. US/Canada & Schengen Zone', 'coverageArea persisted accurately');
  assert(readBackPlan?.destinationId === 'dest-japan', 'destinationId persisted accurately');
  assert(readBackPlan?.medicalCoverageAmount === 750000, 'medicalCoverageAmount persisted accurately');
  assert(readBackPlan?.emergencyAssistanceIncluded === true, 'emergencyAssistanceIncluded boolean flag persisted');
  assert(readBackPlan?.evacuationCoverageAmount === 350000, 'evacuationCoverageAmount persisted');
  assert(readBackPlan?.tripCancellationAmount === 15000, 'tripCancellationAmount persisted');
  assert(readBackPlan?.baggageLossAmount === 5000, 'baggageLossAmount persisted');
  assert(readBackPlan?.validityDaysMax === 60, 'validityDaysMax persisted');
  assert(readBackPlan?.eligibilityAgeMin === 0, 'eligibilityAgeMin persisted');
  assert(readBackPlan?.eligibilityAgeMax === 90, 'eligibilityAgeMax persisted');
  assert(readBackPlan?.netCostPerTrip === 45, 'netCostPerTrip persisted');
  assert(readBackPlan?.sellingPricePerTrip === 65, 'sellingPricePerTrip persisted');
  assert(readBackPlan?.status === 'ACTIVE', 'status persisted');
  assert(readBackPlan?.inclusions.length === 5, 'inclusions array serialized and persisted with 5 items');

  // Check that other plans were NOT corrupted
  const allPlansAfter = db.getTravelProtectionPlans();
  const otherPlans = allPlansAfter.filter(p => p.id !== testId);
  assert(otherPlans.length === existingProtectionPlans.length - 1, 'Other Travel Protection records remain intact and uncorrupted');

  // Restore or keep clean state
  await db.saveTravelProtectionPlanAsync(originalPlanSnapshot, mockAdminUser);
  console.log('Restored original Travel Protection record snapshot.');

  // --------------------------------------------------------------------------
  // TEST SECTION 3: VIP GROUND SERVICES EDITING & LIFECYCLE PERSISTENCE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 3: VIP Ground Services Field Updates & Persistence ---');
  
  const existingVipServices = db.getVipGroundServices();
  assert(existingVipServices.length > 0, `VIP Ground services loaded (${existingVipServices.length} records)`);

  const targetVip = existingVipServices[0];
  const originalVipSnapshot = JSON.parse(JSON.stringify(targetVip));
  const testVipId = targetVip.id;

  const updatedVip: VipGroundService = {
    ...targetVip,
    name: 'Executive Airside Gate Chaperone & Tarmac Limousine Transfer',
    serviceType: 'CHAUFFEUR',
    destinationId: 'dest-japan',
    hubId: 'HND - Tokyo Haneda International',
    supplierName: 'Executive Global Chauffeurs & Concierge Ltd',
    shortDesc: 'VIP gate-side escort with private tarmac limousine and fast-track immigration.',
    longDesc: 'Premium airside meet & greet directly at aircraft aerobridge with private limousine apron transfer, dedicated customs fast-track, and luggage porterage.',
    pricingType: 'PER_VEHICLE',
    netCost: 220,
    sellingPrice: 320,
    defaultMarkupPercent: 35,
    currency: 'USD',
    badge: 'Airside Elite VIP',
    status: 'ACTIVE',
    inclusions: [
      'Aerobridge Aircraft Gate Greeting',
      'Private Apron Mercedes-Maybach Limousine Transfer',
      'Priority Diplomatic Lane Immigration Clearance',
      'Baggage Collection & Chauffeur Vehicle Loading'
    ]
  };

  const savedVipResult = await db.saveVipGroundServiceAsync(updatedVip, mockAdminUser);
  assert(savedVipResult.id === testVipId, 'VIP Ground Service preserves document ID');

  const readBackVip = db.getVipGroundServiceById(testVipId);
  assert(!!readBackVip, 'VIP Ground Service read back successfully');
  assert(readBackVip?.name === 'Executive Airside Gate Chaperone & Tarmac Limousine Transfer', 'VIP name persisted');
  assert(readBackVip?.serviceType === 'CHAUFFEUR', 'VIP serviceType extended enum CHAUFFEUR persisted');
  assert(readBackVip?.hubId === 'HND - Tokyo Haneda International', 'hubId persisted');
  assert(readBackVip?.supplierName === 'Executive Global Chauffeurs & Concierge Ltd', 'supplierName persisted');
  assert(readBackVip?.pricingType === 'PER_VEHICLE', 'pricingType PER_VEHICLE persisted');
  assert(readBackVip?.netCost === 220, 'netCost persisted');
  assert(readBackVip?.sellingPrice === 320, 'sellingPrice persisted');
  assert(readBackVip?.badge === 'Airside Elite VIP', 'badge persisted');
  assert(readBackVip?.inclusions.length === 4, 'inclusions list persisted');

  // Restore clean state
  await db.saveVipGroundServiceAsync(originalVipSnapshot, mockAdminUser);
  console.log('Restored original VIP Ground service snapshot.');

  // --------------------------------------------------------------------------
  // TEST SECTION 4: 5G CONNECTIVITY & eSIM EDITING & PERSISTENCE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 4: 5G Connectivity Plans Field Updates & Persistence ---');
  
  const existingConnPlans = db.getConnectivityPlans();
  assert(existingConnPlans.length > 0, `Connectivity plans loaded (${existingConnPlans.length} records)`);

  const targetConn = existingConnPlans[0];
  const originalConnSnapshot = JSON.parse(JSON.stringify(targetConn));
  const testConnId = targetConn.id;

  const updatedConn: ConnectivityPlan = {
    ...targetConn,
    name: '5G Pan-Asia & Japan Unlimited High-Speed eSIM (30 Days)',
    type: 'ESIM',
    coverageZone: 'Japan, South Korea, Singapore, Thailand, UAE, Taiwan (16 Destinations)',
    dataAllowance: 'Unlimited 5G Data Uncapped',
    validityDays: 30,
    networkSpeed: '5G Ultra Wideband / NTT Docomo Native',
    netCost: 28,
    sellingPrice: 45,
    currency: 'USD',
    status: 'ACTIVE',
    inclusions: [
      'Instant QR Code Email Delivery within 60 Seconds',
      'Dual SIM / Multi-Carrier Hotspot & Tethering Permitted',
      'Zero Profile Swapping Across 16 Asian Destinations',
      'Local Carrier Priority Routing'
    ]
  };

  const savedConnResult = await db.saveConnectivityPlanAsync(updatedConn, mockAdminUser);
  assert(savedConnResult.id === testConnId, 'Connectivity plan preserves document ID');

  const readBackConn = db.getConnectivityPlanById(testConnId);
  assert(!!readBackConn, 'Connectivity plan read back successfully');
  assert(readBackConn?.name === '5G Pan-Asia & Japan Unlimited High-Speed eSIM (30 Days)', 'eSIM name persisted');
  assert(readBackConn?.type === 'ESIM', 'SIM type ESIM persisted');
  assert(readBackConn?.coverageZone.includes('Japan, South Korea'), 'coverageZone persisted');
  assert(readBackConn?.dataAllowance === 'Unlimited 5G Data Uncapped', 'dataAllowance persisted');
  assert(readBackConn?.validityDays === 30, 'validityDays persisted');
  assert(readBackConn?.networkSpeed === '5G Ultra Wideband / NTT Docomo Native', 'networkSpeed persisted');
  assert(readBackConn?.netCost === 28, 'netCost persisted');
  assert(readBackConn?.sellingPrice === 45, 'sellingPrice persisted');
  assert(readBackConn?.status === 'ACTIVE', 'status persisted');
  assert(readBackConn?.inclusions.length === 4, 'inclusions parsed and persisted');

  // Restore clean state
  await db.saveConnectivityPlanAsync(originalConnSnapshot, mockAdminUser);
  console.log('Restored original Connectivity plan snapshot.');

  // --------------------------------------------------------------------------
  // TEST SECTION 6: COMPLETE CRUD DELETION PERSISTENCE & EMPTY STATE GUARANTEE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 6: Complete CRUD Deletion Persistence & Empty State Guarantee ---');

  // Save current snapshots before testing deletion of all records
  const initialVisaSnapshot = JSON.parse(JSON.stringify(db.getVisas()));
  const initialProtSnapshot = JSON.parse(JSON.stringify(db.getTravelProtectionPlans()));
  const initialVipSnapshot = JSON.parse(JSON.stringify(db.getVipGroundServices()));
  const initialConnSnapshot = JSON.parse(JSON.stringify(db.getConnectivityPlans()));

  // 6.1 Test Deletion of ALL Visa records
  console.log('Testing total deletion of Visa services...');
  for (const visa of initialVisaSnapshot) {
    const delRes = await db.deleteVisaAsync(visa.id, mockAdminUser);
    assert(delRes.success === true, `Visa ${visa.id} deleted successfully via deleteVisaAsync`);
  }
  const visasAfterAllDeleted = db.getVisas();
  assert(visasAfterAllDeleted.length === 0, `All visas deleted: getVisas() returns 0 items (got ${visasAfterAllDeleted.length}), NO fallback resurrection`);

  // 6.2 Test Deletion of ALL Travel Protection records
  console.log('Testing total deletion of Travel Protection plans...');
  for (const prot of initialProtSnapshot) {
    const delRes = await db.deleteTravelProtectionPlanAsync(prot.id, mockAdminUser);
    assert(delRes.success === true, `Travel Protection ${prot.id} deleted successfully via deleteTravelProtectionPlanAsync`);
  }
  const protAfterAllDeleted = db.getTravelProtectionPlans();
  assert(protAfterAllDeleted.length === 0, `All travel protection plans deleted: getTravelProtectionPlans() returns 0 items (got ${protAfterAllDeleted.length}), NO fallback resurrection`);

  // 6.3 Test Deletion of ALL VIP Ground records via secureDeleteRecordAsync
  console.log('Testing total deletion of VIP Ground services via secureDeleteRecordAsync...');
  for (const vip of initialVipSnapshot) {
    const secRes = await db.secureDeleteRecordAsync('VipGroundService', vip.id, mockAdminUser);
    assert(secRes.success === true, `VIP Ground Service ${vip.id} deleted via secureDeleteRecordAsync`);
  }
  const vipAfterAllDeleted = db.getVipGroundServices();
  assert(vipAfterAllDeleted.length === 0, `All VIP ground services deleted: getVipGroundServices() returns 0 items (got ${vipAfterAllDeleted.length}), NO fallback resurrection`);

  // 6.4 Test Deletion of ALL Connectivity records via secureDeleteRecordAsync
  console.log('Testing total deletion of Connectivity plans via secureDeleteRecordAsync...');
  for (const conn of initialConnSnapshot) {
    const secRes = await db.secureDeleteRecordAsync('ConnectivityPlan', conn.id, mockAdminUser);
    assert(secRes.success === true, `Connectivity plan ${conn.id} deleted via secureDeleteRecordAsync`);
  }
  const connAfterAllDeleted = db.getConnectivityPlans();
  assert(connAfterAllDeleted.length === 0, `All connectivity plans deleted: getConnectivityPlans() returns 0 items (got ${connAfterAllDeleted.length}), NO fallback resurrection`);

  // 6.5 Verify purgeTombstonedItems preserves empty states
  db.purgeTombstonedItems();
  assert(db.getVisas().length === 0, 'purgeTombstonedItems: Visas remain empty (0 records)');
  assert(db.getTravelProtectionPlans().length === 0, 'purgeTombstonedItems: Travel protection remains empty (0 records)');
  assert(db.getVipGroundServices().length === 0, 'purgeTombstonedItems: VIP ground remains empty (0 records)');
  assert(db.getConnectivityPlans().length === 0, 'purgeTombstonedItems: Connectivity remains empty (0 records)');

  // 6.6 Verify creation of a new item into an empty collection
  console.log('Testing creation of single new service into empty collection...');
  const newProtPlan: TravelProtectionPlan = {
    id: `PROT-NEW-${Date.now()}`,
    serviceName: 'Single Clean Newly Created Travel Protection',
    provider: 'Global Cover',
    coverageArea: 'Worldwide',
    medicalCoverageAmount: 100000,
    emergencyAssistanceIncluded: true,
    evacuationCoverageAmount: 50000,
    tripCancellationAmount: 2000,
    baggageLossAmount: 1000,
    validityDaysMax: 30,
    eligibilityAgeMin: 0,
    eligibilityAgeMax: 80,
    netCostPerTrip: 20,
    sellingPricePerTrip: 35,
    netCostPerDay: 0,
    sellingPricePerDay: 0,
    currency: 'USD',
    status: 'ACTIVE',
    terms: 'Standard terms',
    customerDescription: 'Clean new plan',
    inclusions: ['Emergency Assistance']
  };
  await db.saveTravelProtectionPlanAsync(newProtPlan, mockAdminUser);
  const protListWithOne = db.getTravelProtectionPlans();
  assert(protListWithOne.length === 1, `Exactly 1 travel protection plan exists after creation (got ${protListWithOne.length})`);
  assert(protListWithOne[0].id === newProtPlan.id, 'The created plan matches expected ID');

  // Clean up test new item
  await db.deleteTravelProtectionPlanAsync(newProtPlan.id, mockAdminUser);

  // 6.7 Restore all original snapshots cleanly
  console.log('Restoring all original snapshots for test idempotency...');
  for (const v of initialVisaSnapshot) {
    await db.saveVisaAsync(v, mockAdminUser);
  }
  for (const p of initialProtSnapshot) {
    await db.saveTravelProtectionPlanAsync(p, mockAdminUser);
  }
  for (const s of initialVipSnapshot) {
    await db.saveVipGroundServiceAsync(s, mockAdminUser);
  }
  for (const c of initialConnSnapshot) {
    await db.saveConnectivityPlanAsync(c, mockAdminUser);
  }

  assert(db.getVisas().length === initialVisaSnapshot.length, `Visas restored cleanly (${db.getVisas().length} records)`);
  assert(db.getTravelProtectionPlans().length === initialProtSnapshot.length, `Protection plans restored cleanly (${db.getTravelProtectionPlans().length} records)`);
  assert(db.getVipGroundServices().length === initialVipSnapshot.length, `VIP ground restored cleanly (${db.getVipGroundServices().length} records)`);
  assert(db.getConnectivityPlans().length === initialConnSnapshot.length, `Connectivity restored cleanly (${db.getConnectivityPlans().length} records)`);

  console.log('\n===============================================================');
  console.log('🎉 ALL VISA & ANCILLARY SERVICES AUDIT TESTS PASSED WITH 100% SUCCESS');
  console.log('===============================================================\n');
}

runAudit().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});

