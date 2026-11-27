import type { Request } from 'express';
import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseAppletConfig from '../firebase-applet-config.json';

/**
 * Authoritative Server-Side Firebase Initialization & ID Token Verification.
 *
 * Architectural separation:
 * - Frontend uses Firebase Client SDK (`src/services/firebase.ts`) with the web config.
 * - Backend uses Firebase Admin SDK (`firebase-admin/app` + `firebase-admin/auth`)
 *   initialized ONCE as a singleton with `projectId` only — requiring NO client `apiKey`,
 *   NO service account private key, and NO IAM roles for cryptographic `verifyIdToken()`.
 * - Firestore REST reads/writes target the authoritative named database using the verified
 *   caller's Bearer ID token so both server RBAC and `firestore.rules` are strictly enforced.
 */

const AUTHORITATIVE_PROJECT_ID = 'gen-lang-client-0981426327';
const AUTHORITATIVE_DATABASE_ID =
  'ai-studio-theunbounddmctra-384adde8-26cf-49a7-8158-336473069762';

export interface ServerFirebaseConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

let cachedConfig: ServerFirebaseConfig | null = null;
let cachedAdminApp: App | null = null;

function isPlaceholderValue(val: string | undefined): boolean {
  if (!val) return true;
  const normalized = val.trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'remixed-project-id' ||
    normalized === 'remixed-firestore-database-id'
  );
}

/**
 * Resolves the authoritative Firebase Project ID and Firestore Database ID for server code.
 * Never depends on `import.meta.url` (which is undefined in CJS bundles) and never requires
 * a Firebase Client SDK `apiKey`.
 */
export function getServerFirebaseConfig(): ServerFirebaseConfig {
  if (cachedConfig) return cachedConfig;

  const envProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;
  const jsonProjectId = (firebaseAppletConfig as Record<string, any>)?.projectId;
  const projectId = !isPlaceholderValue(envProjectId)
    ? String(envProjectId).trim()
    : !isPlaceholderValue(jsonProjectId)
      ? String(jsonProjectId).trim()
      : AUTHORITATIVE_PROJECT_ID;

  const envDbId = process.env.FIRESTORE_DATABASE_ID;
  const jsonDbId = (firebaseAppletConfig as Record<string, any>)?.firestoreDatabaseId;
  const firestoreDatabaseId = !isPlaceholderValue(envDbId)
    ? String(envDbId).trim()
    : !isPlaceholderValue(jsonDbId)
      ? String(jsonDbId).trim()
      : AUTHORITATIVE_DATABASE_ID;

  cachedConfig = {
    projectId,
    firestoreDatabaseId
  };
  return cachedConfig;
}

export function getServerFirestoreDatabasePath(): string {
  const cfg = getServerFirebaseConfig();
  return `projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
}

export function getServerFirestoreBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/${getServerFirestoreDatabasePath()}`;
}

/**
 * Initializes Firebase Admin SDK once per process and reuses the singleton instance.
 * Only requires `projectId` — never requires a Firebase Client SDK `apiKey` or hardcoded secrets.
 */
export function getFirebaseAdminApp(): App {
  if (cachedAdminApp) return cachedAdminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedAdminApp = getApp();
    return cachedAdminApp;
  }

  const { projectId } = getServerFirebaseConfig();
  cachedAdminApp = initializeApp({ projectId });
  return cachedAdminApp;
}

export function extractBearerToken(
  req: Request
): { ok: true; idToken: string } | { ok: false; status: number; error: string } {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required: missing Bearer Firebase ID token.'
    };
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required: empty Firebase ID token.'
    };
  }
  return { ok: true, idToken };
}

export interface VerifiedFirebaseIdTokenResult {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  claims: DecodedIdToken;
}

/**
 * Cryptographically verifies a Firebase Authentication ID token via Firebase Admin SDK
 * (`getAuth(app).verifyIdToken(idToken)`). Validates RS256 signature, issuer, project audience,
 * expiration, and subject UID without requiring a client `apiKey` or IAM privileges.
 */
export async function verifyServerFirebaseIdToken(
  idToken: string
): Promise<
  | { ok: true; token: VerifiedFirebaseIdTokenResult }
  | { ok: false; status: number; error: string }
> {
  const cleanToken = (idToken || '').trim();
  if (!cleanToken) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required: empty Firebase ID token.'
    };
  }

  try {
    const adminApp = getFirebaseAdminApp();
    const decoded = await getAuth(adminApp).verifyIdToken(cleanToken);
    const uid = String(decoded.uid || decoded.sub || '').trim();
    if (!uid) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid Firebase authentication token: missing user identifier.'
      };
    }

    return {
      ok: true,
      token: {
        uid,
        email: String(decoded.email || '').trim().toLowerCase(),
        displayName: String(decoded.name || '').trim(),
        emailVerified: Boolean(decoded.email_verified),
        claims: decoded
      }
    };
  } catch (err: any) {
    const code = String(err?.code || '');
    const message = String(err?.message || '');

    if (
      code.startsWith('auth/id-token-expired') ||
      message.toLowerCase().includes('expired')
    ) {
      return {
        ok: false,
        status: 401,
        error: 'Firebase authentication session expired. Please refresh or sign in again.'
      };
    }

    if (
      code.startsWith('auth/argument-error') ||
      code.startsWith('auth/invalid-id-token') ||
      code.startsWith('auth/id-token-revoked') ||
      code.startsWith('auth/user-disabled')
    ) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid or unauthorized Firebase authentication token.'
      };
    }

    console.error('[FIREBASE-SERVER-AUTH] Token verification failed:', code || message);
    return {
      ok: false,
      status: 401,
      error: 'Unable to verify Firebase authentication token.'
    };
  }
}
