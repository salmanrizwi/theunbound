import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { 
  authService, 
  AuthState,
  AuthResult, 
  RegisterProfileData, 
  normalizeEmail 
} from '../services/authService';
import { resolvePostLoginDestination, navigateTo, clearIntendedPath } from '../services/portalRouter';

export type { AuthState, AuthResult, RegisterProfileData };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authState: AuthState;
  isInitializing: boolean;
  authError: string | null;
  role: UserRole;
  isAuthModalOpen: boolean;
  authModalReason: string;
  login: (email: string, role?: UserRole, password?: string) => Promise<AuthResult>;
  register: (profileData: RegisterProfileData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<User | null>;
  openAuthModal: (reason?: string, onAuthenticatedCallback?: () => void) => void;
  closeAuthModal: () => void;
  requireAuth: (callback: () => void, reason?: string) => boolean;
}

const STORAGE_KEY_AUTH = 'theunbound_auth_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => authService.getAuthState());
  const [authError, setAuthError] = useState<string | null>(() => authService.getAuthError());

  // Initialize cached display user for initial render while verifying with Firebase Auth
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY_AUTH);
    if (saved) {
      try {
        const parsed: User = JSON.parse(saved);
        if (parsed && (parsed.role === 'BUYER' || (parsed as any).userType === 'BUYER')) {
          localStorage.removeItem(STORAGE_KEY_AUTH);
          return null;
        }
        return parsed;
      } catch (e) {
        console.error('[AUTH] Error parsing cached auth state:', e);
      }
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string>('Access Protected Pricing Calculator');
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  // Synchronize state with authoritative AuthService state machine
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuth((authoritativeUser, state, error) => {
      console.log(`[AUTH-CTX] Auth state transition: ${state}, User: ${authoritativeUser?.email || 'NONE'}`);
      setAuthState(state);
      setAuthError(error || null);

      if (state === 'AUTHENTICATED_READY' && authoritativeUser) {
        setUser(authoritativeUser);
        try {
          // Store sanitized display profile without password
          const sanitized = { ...authoritativeUser };
          delete sanitized.password;
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sanitized));
        } catch (e) {
          // Ignore
        }
      } else if (state === 'UNAUTHENTICATED') {
        setUser(null);
        try {
          localStorage.removeItem(STORAGE_KEY_AUTH);
        } catch (e) {
          // Ignore
        }
      }
      // Critical: During AUTH_INITIALIZING or AUTHENTICATED_PROFILE_LOADING, do NOT clear user or storage!
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for custom dispatch events if any component updates user profile
  useEffect(() => {
    const handleAuthChanged = (e: any) => {
      if (e.detail) {
        setUser(e.detail);
        try {
          const sanitized = { ...e.detail };
          delete sanitized.password;
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sanitized));
        } catch (err) {
          // Ignore
        }
      }
    };
    window.addEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
    return () => window.removeEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
  }, []);

  const isInitializing = authState === 'AUTH_INITIALIZING' || authState === 'AUTHENTICATED_PROFILE_LOADING';
  const isAuthenticated = authState === 'AUTHENTICATED_READY' && !!user;

  /**
   * Universal Login Handler
   * Authenticates against Firebase Authentication, then resolves Firestore /users/{uid} profile.
   */
  const login = async (email: string, role: UserRole = 'B2B_AGENT', password?: string): Promise<AuthResult> => {
    if (role === 'BUYER') {
      return {
        success: false,
        error: 'Direct consumer login is not supported on TheUnbound. Please contact business@theunbound.in or sign in with an authorized B2B travel partner account.'
      };
    }

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your registered email address.' };
    }

    const result = await authService.login(cleanEmail, password, role);

    if (result.success && result.user) {
      setUser(result.user);
      setIsAuthModalOpen(false);

      if (pendingCallback) {
        pendingCallback();
        setPendingCallback(null);
      }

      // Navigate to correct portal destination based on role and intended path
      const targetRoute = resolvePostLoginDestination(result.user);
      navigateTo(targetRoute);
    }

    return result;
  };

  /**
   * Universal Registration Handler
   * Creates real user account in Firebase Authentication, writes /users/{uid} in Firestore.
   */
  const register = async (profileData: RegisterProfileData): Promise<AuthResult> => {
    const result = await authService.register(profileData);

    if (!result.success || !result.user) {
      return result;
    }

    // If B2B Agent registration requires admin approval
    if (result.requiresApproval) {
      return result;
    }

    // Auto-approved buyer or internal user
    setUser(result.user);
    setIsAuthModalOpen(false);

    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }

    const targetRoute = resolvePostLoginDestination(result.user);
    navigateTo(targetRoute);

    return result;
  };

  /**
   * Universal Logout Handler
   */
  const logout = async (): Promise<void> => {
    await authService.logout('USER_INITIATED');
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      sessionStorage.removeItem('theunbound_b2b_session');
      sessionStorage.removeItem('theunbound_cms_session');
    } catch (e) {
      // Ignore
    }
    clearIntendedPath();
    navigateTo('/');
  };

  /**
   * Update Profile Information across Firestore and active state
   */
  const updateUserProfile = async (updates: Partial<User>): Promise<User | null> => {
    if (!user) return null;
    const updated = await authService.updateUserProfile(user.id, updates);
    if (updated) {
      setUser(updated);
      try {
        const sanitized = { ...updated };
        delete sanitized.password;
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sanitized));
      } catch (e) {
        // Ignore
      }
      return updated;
    }

    // Local fallback
    const fallbackUser: User = {
      ...user,
      ...updates
    };
    setUser(fallbackUser);
    try {
      const sanitized = { ...fallbackUser };
      delete sanitized.password;
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sanitized));
    } catch (e) {
      // Ignore
    }
    return fallbackUser;
  };

  const openAuthModal = (reason = 'Access Protected Pricing Calculator', callback?: () => void) => {
    setAuthModalReason(reason);
    if (callback) {
      setPendingCallback(() => callback);
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPendingCallback(null);
  };

  const requireAuth = (callback: () => void, reason = 'Login required to access dynamic pricing and quotations'): boolean => {
    if (isAuthenticated && user) {
      callback();
      return true;
    }
    openAuthModal(reason, callback);
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        authState,
        isInitializing,
        authError,
        role: user ? user.role : 'PUBLIC',
        isAuthModalOpen,
        authModalReason,
        login,
        register,
        logout,
        updateUserProfile,
        openAuthModal,
        closeAuthModal,
        requireAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
