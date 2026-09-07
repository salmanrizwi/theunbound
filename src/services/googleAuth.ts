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
  apiKey?: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  scopes: string[];
  lastAuthenticatedAt?: string;
  authMode?: 'OAUTH_POPUP' | 'API_KEY' | 'ACCESS_TOKEN' | 'DEMO_SIMULATION';
}

const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
];

class GoogleAuthService {
  private static instance: GoogleAuthService;
  private provider: GoogleAuthProvider;
  private inMemoryToken: string | null = null;
  private inMemoryApiKey: string | null = null;
  private authStateListeners: Array<(state: GoogleAuthState) => void> = [];

  private constructor() {
    this.provider = new GoogleAuthProvider();
    WORKSPACE_SCOPES.forEach(scope => {
      this.provider.addScope(scope);
    });
    this.provider.setCustomParameters({
      prompt: 'select_account'
    });

    // Initialize token and API key from storage if available
    if (typeof window !== 'undefined') {
      this.inMemoryToken = sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token');
      this.inMemoryApiKey = sessionStorage.getItem('google_api_key') || localStorage.getItem('google_api_key');
      
      // Also check calendar config
      try {
        const calConfig = localStorage.getItem('theunbound_calendar_config');
        if (calConfig) {
          const parsed = JSON.parse(calConfig);
          if (parsed.apiKey && !this.inMemoryApiKey) this.inMemoryApiKey = parsed.apiKey;
          if (parsed.accessToken && !this.inMemoryToken) this.inMemoryToken = parsed.accessToken;
        }
      } catch (e) {
        // Ignore
      }
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

  public async signIn(): Promise<GoogleAuthState> {
    return this.signInWithGoogle();
  }

  public async signInWithGoogle(): Promise<GoogleAuthState> {
    try {
      const result = await signInWithPopup(auth, this.provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        this.saveAuth(token, result.user);
        return this.getAuthState();
      } else {
        throw new Error('Google OAuth sign-in completed, but did not return an access token for workspace scopes.');
      }
    } catch (error: any) {
      console.error('Google OAuth sign-in failed:', error);
      throw error;
    }
  }

  public getAuthState(): GoogleAuthState {
    const token = this.getAccessToken();
    const apiKey = this.getApiKey();
    const currentUser = auth.currentUser;
    const storedEmail = typeof window !== 'undefined' ? (localStorage.getItem('google_user_email') || currentUser?.email) : currentUser?.email;
    const storedName = typeof window !== 'undefined' ? (localStorage.getItem('google_user_name') || currentUser?.displayName) : currentUser?.displayName;
    const storedPhoto = typeof window !== 'undefined' ? (localStorage.getItem('google_user_photo') || currentUser?.photoURL) : currentUser?.photoURL;
    const lastAuth = typeof window !== 'undefined' ? localStorage.getItem('google_last_auth_at') : null;
    const authMode = typeof window !== 'undefined' ? (localStorage.getItem('google_auth_mode') as any) : undefined;

    const isAuthed = Boolean(token || apiKey);

    return {
      isAuthenticated: isAuthed,
      accessToken: token,
      apiKey: apiKey,
      email: storedEmail || (isAuthed ? currentUser?.email || 'business@theunbound.in' : null),
      displayName: storedName || (isAuthed ? currentUser?.displayName || 'TheUnbound Workspace' : null),
      photoURL: storedPhoto || null,
      scopes: WORKSPACE_SCOPES,
      lastAuthenticatedAt: lastAuth || undefined,
      authMode: authMode || (apiKey ? 'API_KEY' : (token ? 'ACCESS_TOKEN' : 'OAUTH_POPUP'))
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

  public getApiKey(): string | null {
    if (this.inMemoryApiKey) return this.inMemoryApiKey;
    if (typeof window !== 'undefined') {
      const key = sessionStorage.getItem('google_api_key') || localStorage.getItem('google_api_key');
      if (key) {
        this.inMemoryApiKey = key;
        return key;
      }
    }
    return null;
  }

  public setApiKey(apiKey: string, email: string = 'business@theunbound.in'): GoogleAuthState {
    const cleanKey = apiKey.trim();
    this.inMemoryApiKey = cleanKey || null;
    if (typeof window !== 'undefined') {
      if (cleanKey) {
        sessionStorage.setItem('google_api_key', cleanKey);
        localStorage.setItem('google_api_key', cleanKey);
        localStorage.setItem('google_auth_mode', 'API_KEY');
        localStorage.setItem('google_user_email', email);
        localStorage.setItem('google_last_auth_at', new Date().toISOString());
      } else {
        sessionStorage.removeItem('google_api_key');
        localStorage.removeItem('google_api_key');
      }
      window.dispatchEvent(new CustomEvent('google-auth-changed'));
    }
    this.notifyListeners();
    return this.getAuthState();
  }

  public setManualToken(
    token: string, 
    email: string = 'business@theunbound.in', 
    mode: 'ACCESS_TOKEN' | 'DEMO_SIMULATION' | 'OAUTH_POPUP' | 'API_KEY' = 'ACCESS_TOKEN'
  ): GoogleAuthState {
    if (!token.trim()) {
      throw new Error('Token cannot be empty');
    }
    const cleanToken = token.trim();
    this.inMemoryToken = cleanToken;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('google_access_token', cleanToken);
      localStorage.setItem('google_access_token', cleanToken);
      localStorage.setItem('google_auth_mode', mode);
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
    this.inMemoryApiKey = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('google_access_token');
      localStorage.removeItem('google_access_token');
      sessionStorage.removeItem('google_api_key');
      localStorage.removeItem('google_api_key');
      localStorage.removeItem('google_auth_mode');
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
