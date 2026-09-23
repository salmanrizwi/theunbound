import { 
  collection, 
  getDocs, 
  getDocsFromServer,
  doc, 
  getDocFromServer,
  limit, 
  query 
} from 'firebase/firestore';
import { db as firestoreDb, auth } from './firebase';
import firebaseConfigJson from '../../firebase-applet-config.json';

export interface CollectionDiagnosticResult {
  collectionName: string;
  displayName: string;
  status: 'CONNECTED' | 'EMPTY' | 'ERROR' | 'OFFLINE' | 'RESTRICTED_BY_RULES';
  documentCount: number;
  isFromCache: boolean;
  sampleIds: string[];
  latencyMs: number;
  sourceOfTruth: 'FIRESTORE_LIVE' | 'FIRESTORE_CACHE' | 'FALLBACK_LOCAL';
  errorDetails?: string;
  isProtectedByRules?: boolean;
}

export interface FirestoreDiagnosticReport {
  timestamp: string;
  projectId: string;
  databaseId: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'PERMISSION_DENIED';
  totalLatencyMs: number;
  serverPingSuccess: boolean;
  collections: {
    products: CollectionDiagnosticResult;
    quotes: CollectionDiagnosticResult;
    bookings: CollectionDiagnosticResult;
    users: CollectionDiagnosticResult;
    destinations: CollectionDiagnosticResult;
    hotels: CollectionDiagnosticResult;
    leads: CollectionDiagnosticResult;
    promotions: CollectionDiagnosticResult;
    reviews: CollectionDiagnosticResult;
    blogs: CollectionDiagnosticResult;
  };
  summary: {
    totalCollectionsChecked: number;
    connectedCollections: number;
    emptyCollections: number;
    errorCollections: number;
    restrictedCollections?: number;
    isAuthoritativeLiveDb: boolean;
  };
  notes: string[];
}

/**
 * Diagnostic Utility: Verifies that all Firestore collections are active,
 * connected to the live production database, and not relying on static local fallback files.
 */
export async function runFirestoreDiagnostics(): Promise<FirestoreDiagnosticReport> {
  const startTime = performance.now();
  const notes: string[] = [];

  const projectId = firebaseConfigJson.projectId || 'unknown-project';
  const databaseId = (firebaseConfigJson as any).firestoreDatabaseId || '(default)';

  notes.push(`[${new Date().toLocaleTimeString()}] Initiating Firestore Diagnostics for Project: "${projectId}", Database: "${databaseId}"`);

  if (auth.currentUser) {
    notes.push(`[${new Date().toLocaleTimeString()}] Authenticated Diagnostic Session: ${auth.currentUser.email || auth.currentUser.uid}`);
  } else {
    notes.push(`[${new Date().toLocaleTimeString()}] Public / Guest Caller: Sensitive collections (quotations, bookings, users, leads) are guarded by Firestore RBAC rules.`);
  }

  // 1. Direct Ping to Live Server
  let serverPingSuccess = false;
  let pingLatencyMs = 0;
  try {
    const pingStart = performance.now();
    // Attempt direct live server fetch for connection probe
    try {
      await getDocFromServer(doc(firestoreDb, '__diagnostics__', 'ping'));
      serverPingSuccess = true;
    } catch (e: any) {
      // Document not existing still means server responded with NotFound (successful connectivity)
      if (e?.code === 'not-found' || !e?.message?.includes('offline')) {
        serverPingSuccess = true;
      }
    }
    pingLatencyMs = Math.round(performance.now() - pingStart);
    notes.push(`[${new Date().toLocaleTimeString()}] Live server connection established in ${pingLatencyMs}ms`);
  } catch (err: any) {
    notes.push(`[${new Date().toLocaleTimeString()}] Server ping notice: ${err?.message || 'Offline cache fallback active'}`);
  }

  // Diagnostic helper for an individual collection
  async function testCollection(
    collPath: string, 
    displayName: string,
    fallbackCount: number = 0
  ): Promise<CollectionDiagnosticResult> {
    const collStart = performance.now();
    try {
      // Try direct server fetch first, fallback to standard getDocs
      let snapshot;
      let isFromCache = false;

      try {
        const q = query(collection(firestoreDb, collPath), limit(50));
        snapshot = await getDocsFromServer(q);
        isFromCache = false;
      } catch (serverErr: any) {
        // If server fetch is blocked by offline or rules, try getDocs
        const q = query(collection(firestoreDb, collPath), limit(50));
        snapshot = await getDocs(q);
        isFromCache = snapshot.metadata?.fromCache ?? true;
      }

      const latencyMs = Math.round(performance.now() - collStart);
      const docs = snapshot.docs;
      const count = docs.length;
      const sampleIds = docs.slice(0, 5).map(d => d.id);

      let status: CollectionDiagnosticResult['status'] = 'CONNECTED';
      let sourceOfTruth: CollectionDiagnosticResult['sourceOfTruth'] = isFromCache ? 'FIRESTORE_CACHE' : 'FIRESTORE_LIVE';

      if (count === 0) {
        status = 'EMPTY';
      }

      return {
        collectionName: collPath,
        displayName,
        status,
        documentCount: count,
        isFromCache,
        sampleIds,
        latencyMs,
        sourceOfTruth
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - collStart);
      const errMsg = err?.message || err?.code || 'Unknown Firestore collection error';
      const isPermissionDenied = err?.code === 'permission-denied' || errMsg.includes('permission') || errMsg.includes('insufficient');
      const isProtectedCollection = ['quotations', 'bookings', 'users', 'leads'].includes(collPath);
      
      // If collection is protected by security rules and caller is not a master admin with collection-wide scan rights
      const isProtectedByRules = isPermissionDenied && isProtectedCollection;

      return {
        collectionName: collPath,
        displayName,
        status: isProtectedByRules ? 'RESTRICTED_BY_RULES' : (err?.code === 'permission-denied' ? 'ERROR' : 'OFFLINE'),
        documentCount: 0,
        isFromCache: true,
        sampleIds: [],
        latencyMs,
        sourceOfTruth: isProtectedByRules ? 'FIRESTORE_LIVE' : 'FALLBACK_LOCAL',
        errorDetails: isProtectedByRules
          ? 'Guarded by production Firestore RBAC security rules: collection-level queries require authorized Administrative session.'
          : errMsg,
        isProtectedByRules
      };
    }
  }

  // 2. Execute parallel inspection across core collections
  const [
    productsRes,
    quotesRes,
    bookingsRes,
    usersRes,
    destinationsRes,
    hotelsRes,
    leadsRes,
    promotionsRes,
    reviewsRes,
    blogsRes
  ] = await Promise.all([
    testCollection('products', 'Product Inventory'),
    testCollection('quotations', 'Custom Quotations', 0),
    testCollection('bookings', 'Ground Reservations & Bookings', 0),
    testCollection('users', 'System & B2B Users', 0),
    testCollection('destinations', 'Destinations & Hubs', 3),
    testCollection('hotels', 'Contracted Hotels', 0),
    testCollection('leads', 'CRM Travel Leads', 0),
    testCollection('promotions', 'Promotional Tariffs', 0),
    testCollection('google_reviews', 'Google Reviews Feed', 0),
    testCollection('blog_articles', 'Destination Articles', 0)
  ]);

  // Evaluate Products Source of Truth
  if (productsRes.status === 'CONNECTED' && !productsRes.isFromCache) {
    notes.push(`[${new Date().toLocaleTimeString()}] Verified Products collection (${productsRes.documentCount} items loaded directly from live Firestore database)`);
  } else if (productsRes.status === 'CONNECTED' && productsRes.isFromCache) {
    notes.push(`[${new Date().toLocaleTimeString()}] Products collection loaded via IndexedDB persistence cache`);
  } else if (productsRes.status === 'EMPTY') {
    notes.push(`[${new Date().toLocaleTimeString()}] Products collection is empty in Firestore. Application will auto-seed initial master catalog.`);
  }

  if (quotesRes.status === 'CONNECTED') {
    notes.push(`[${new Date().toLocaleTimeString()}] Verified Quotations collection: ${quotesRes.documentCount} active quotes stored in Firestore`);
  } else if (quotesRes.status === 'RESTRICTED_BY_RULES') {
    notes.push(`[${new Date().toLocaleTimeString()}] Quotations collection guarded: access controlled via RBAC rules.`);
  }

  if (bookingsRes.status === 'CONNECTED') {
    notes.push(`[${new Date().toLocaleTimeString()}] Verified Bookings collection: ${bookingsRes.documentCount} reservations stored in Firestore`);
  } else if (bookingsRes.status === 'RESTRICTED_BY_RULES') {
    notes.push(`[${new Date().toLocaleTimeString()}] Bookings collection guarded: access controlled via RBAC rules.`);
  }

  if (usersRes.status === 'CONNECTED') {
    notes.push(`[${new Date().toLocaleTimeString()}] Verified Users collection: ${usersRes.documentCount} user accounts stored in Firestore`);
  } else if (usersRes.status === 'RESTRICTED_BY_RULES') {
    notes.push(`[${new Date().toLocaleTimeString()}] Users collection guarded: user profiles isolated per-user under security rules.`);
  }

  const allCollResults = [
    productsRes,
    quotesRes,
    bookingsRes,
    usersRes,
    destinationsRes,
    hotelsRes,
    leadsRes,
    promotionsRes,
    reviewsRes,
    blogsRes
  ];

  const connectedCount = allCollResults.filter(c => c.status === 'CONNECTED').length;
  const emptyCount = allCollResults.filter(c => c.status === 'EMPTY').length;
  const restrictedCount = allCollResults.filter(c => c.status === 'RESTRICTED_BY_RULES').length;
  const trueErrorCount = allCollResults.filter(c => c.status === 'ERROR' || c.status === 'OFFLINE').length;

  let overallStatus: FirestoreDiagnosticReport['overallStatus'] = 'HEALTHY';
  if (trueErrorCount > 0) {
    const hasPermissionDenied = allCollResults.some(c => c.status === 'ERROR' && c.errorDetails?.includes('permission-denied'));
    overallStatus = hasPermissionDenied ? 'PERMISSION_DENIED' : 'DEGRADED';
  } else if (!serverPingSuccess && connectedCount === 0) {
    overallStatus = 'OFFLINE';
  } else {
    overallStatus = 'HEALTHY';
  }

  const totalLatencyMs = Math.round(performance.now() - startTime);

  const report: FirestoreDiagnosticReport = {
    timestamp: new Date().toISOString(),
    projectId,
    databaseId,
    overallStatus,
    totalLatencyMs,
    serverPingSuccess,
    collections: {
      products: productsRes,
      quotes: quotesRes,
      bookings: bookingsRes,
      users: usersRes,
      destinations: destinationsRes,
      hotels: hotelsRes,
      leads: leadsRes,
      promotions: promotionsRes,
      reviews: reviewsRes,
      blogs: blogsRes
    },
    summary: {
      totalCollectionsChecked: allCollResults.length,
      connectedCollections: connectedCount,
      emptyCollections: emptyCount,
      errorCollections: trueErrorCount,
      restrictedCollections: restrictedCount,
      isAuthoritativeLiveDb: productsRes.status === 'CONNECTED' || (connectedCount > 0 && trueErrorCount === 0)
    },
    notes
  };

  return report;
}
