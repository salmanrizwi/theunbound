/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  enableIndexedDbPersistence, 
  setLogLevel 
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
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

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with auto long-polling to prevent WebChannel / streaming connection dropouts
const customDatabaseId = (firebaseConfigJson as any).firestoreDatabaseId;
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    customDatabaseId && customDatabaseId !== '(default)' ? customDatabaseId : undefined
  );
} catch (e) {
  // Fallback to standard getFirestore if already initialized
  firestoreInstance = customDatabaseId && customDatabaseId !== '(default)'
    ? getFirestore(app, customDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Enable persistence for offline capabilities where supported
try {
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.debug('Firestore persistence note: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.debug('Firestore persistence not supported in this browser environment');
      }
    });
  }
} catch (e) {
  console.debug('Firestore persistence init note:', e);
}
