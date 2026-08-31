import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  User as FirebaseUser,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  scopes: string[];
  lastAuthenticatedAt?: string;
}

const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

class GoogleAuthService {
  private static instance: GoogleAuthService;
  private provider: GoogleAuthProvider;
  private inMemoryToken: string | null = null;
  private authStateListeners: Array<(state: GoogleAuthState) => void> = [];

  private constructor() {
    this.provider = new GoogleAuthProvider();
    WORKSPACE_SCOPES.forEach(scope => {
      this.provider.addScope(scope);
    });
    this.provider.setCustomParameters({
      prompt: 'select_account'
    });

    // Initialize token from storage if available
    if (typeof window !== 'undefined') {
      this.inMemoryToken = sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token');
    }

    // Listen to Firebase Auth state
    onAuthStateChanged(auth, (user) => {
      this.notifyListeners();
    });
  }

  public static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  public getAuthState(): GoogleAuthState {
    const token = this.getAccessToken();
    const currentUser = auth.currentUser;
    const storedEmail = typeof window !== 'undefined' ? (localStorage.getItem('google_user_email') || currentUser?.email) : currentUser?.email;
    const storedName = typeof window !== 'undefined' ? (localStorage.getItem('google_user_name') || currentUser?.displayName) : currentUser?.displayName;
    const storedPhoto = typeof window !== 'undefined' ? (localStorage.getItem('google_user_photo') || currentUser?.photoURL) : currentUser?.photoURL;
    const lastAuth = typeof window !== 'undefined' ? localStorage.getItem('google_last_auth_at') : null;

    return {
      isAuthenticated: !!token,
      accessToken: token,
      email: storedEmail || (token ? 'business@theunbound.in' : null),
      displayName: storedName || (token ? 'TheUnbound Workspace' : null),
      photoURL: storedPhoto || null,
      scopes: WORKSPACE_SCOPES,
      lastAuthenticatedAt: lastAuth || undefined
    };
  }

  public getAccessToken(): string | null {
    if (this.inMemoryToken) return this.inMemoryToken;
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token');
      if (token) {
        this.inMemoryToken = token;
        return token;
      }
    }
    return null;
  }

  public async signIn(): Promise<GoogleAuthState> {
    try {
      const result = await signInWithPopup(auth, this.provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        // Some popup flows might not directly return token if restricted, but let's grab user token
        const idToken = await result.user.getIdToken();
        this.saveAuth(idToken, result.user);
      } else {
        this.saveAuth(token, result.user);
      }

      return this.getAuthState();
    } catch (error: any) {
      console.error('Google Sign-In Popup Error:', error);
      
      // If popup was blocked or iframe restriction encountered, throw clean error
      if (error?.code === 'auth/popup-blocked') {
        throw new Error('Sign-in popup was blocked by your browser. Please allow popups or use direct token authorization.');
      } else if (error?.code === 'auth/cancelled-popup-request' || error?.code === 'auth/popup-closed-by-user') {
        throw new Error('Authentication popup was closed before completion.');
      }
      throw error;
    }
  }

  public setManualToken(token: string, email: string = 'business@theunbound.in'): GoogleAuthState {
    if (!token.trim()) {
      throw new Error('Token cannot be empty');
    }
    const cleanToken = token.trim();
    this.inMemoryToken = cleanToken;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('google_access_token', cleanToken);
      localStorage.setItem('google_access_token', cleanToken);
      localStorage.setItem('google_user_email', email);
      localStorage.setItem('google_user_name', 'TheUnbound Workspace Admin');
      localStorage.setItem('google_last_auth_at', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('google-auth-changed'));
    }
    this.notifyListeners();
    return this.getAuthState();
  }

  public signOut(): void {
    this.inMemoryToken = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('google_access_token');
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_user_email');
      localStorage.removeItem('google_user_name');
      localStorage.removeItem('google_user_photo');
      localStorage.removeItem('google_last_auth_at');
      window.dispatchEvent(new CustomEvent('google-auth-changed'));
    }
    this.notifyListeners();
  }

  public subscribe(callback: (state: GoogleAuthState) => void): () => void {
    this.authStateListeners.push(callback);
    callback(this.getAuthState());
    return () => {
      this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
    };
  }

  private saveAuth(token: string, user: FirebaseUser): void {
    this.inMemoryToken = token;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('google_access_token', token);
      localStorage.setItem('google_access_token', token);
      if (user.email) localStorage.setItem('google_user_email', user.email);
      if (user.displayName) localStorage.setItem('google_user_name', user.displayName);
      if (user.photoURL) localStorage.setItem('google_user_photo', user.photoURL);
      localStorage.setItem('google_last_auth_at', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('google-auth-changed'));
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const state = this.getAuthState();
    this.authStateListeners.forEach(cb => cb(state));
  }
}

export const googleAuth = GoogleAuthService.getInstance();
