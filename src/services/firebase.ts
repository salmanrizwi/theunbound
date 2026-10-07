/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  indexedDBLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider 
} from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};

// Silence noisy internal network/offline status warnings from @firebase/firestore
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore if already set or unsupported in environment
}

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey || metaEnv.VITE_FIREBASE_API_KEY,
  authDomain: firebaseConfigJson.authDomain || metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseConfigJson.projectId || metaEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: firebaseConfigJson.storageBucket || metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseConfigJson.messagingSenderId || metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseConfigJson.appId || metaEnv.VITE_FIREBASE_APP_ID,
};

// Authoritative Firebase Project & Database Identifiers
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId || 'gen-lang-client-0981426327';
export const FIRESTORE_DATABASE_ID = (firebaseConfigJson as any).firestoreDatabaseId || 'ai-studio-theunbounddmctra-384adde8-26cf-49a7-8158-336473069762';

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with in-memory cache and auto long-polling to prevent QuotaExceededError and WebStorage locks
const customDatabaseId = FIRESTORE_DATABASE_ID;
const dbTargetId = customDatabaseId && customDatabaseId !== '(default)' ? customDatabaseId : undefined;

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: memoryLocalCache()
    },
    dbTargetId
  );
} catch (e) {
  // If already initialized or during hot reloads, fallback to getFirestore
  try {
    firestoreInstance = dbTargetId ? getFirestore(app, dbTargetId) : getFirestore(app);
  } catch (fallbackErr) {
    console.warn('[FIREBASE] Firestore fallback init notice:', fallbackErr);
    firestoreInstance = dbTargetId ? getFirestore(app, dbTargetId) : getFirestore(app);
  }
}

export const db = firestoreInstance;

// Initialize Auth with multi-tier persistence cascade and popupRedirectResolver
let authInstance;
try {
  if (typeof window !== 'undefined') {
    authInstance = initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence
      ],
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } else {
    authInstance = getAuth(app);
  }
} catch (authInitErr) {
  // If auth was already initialized by another module, reuse getAuth instance
  authInstance = getAuth(app);
}

export const auth = authInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("[Firebase Connection] Client is offline or Firestore is unreachable. Please verify network connectivity or Firebase configuration.");
      return false;
    }
    // Any other response (like document not found or permissions) confirms connectivity
    return true;
  }
}

if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}

