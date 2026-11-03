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
  isProfileLoading: boolean;
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

function sanitizeUserForClientSession(u: User | null): User | null {
  if (!u) return null;
  const clone: User = { ...u };
  delete clone.password;
  const isAgentRole = clone.role === 'B2B_AGENT' || clone.role === 'AGENT' || clone.role === 'AGENCY_OWNER';
  if (isAgentRole) {
    delete (clone as any).pricingSettings;
    delete (clone as any).customAgentMarginPercent;
  }
  return clone;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => authService.getAuthState());
  const [authError, setAuthError] = useState<string | null>(() => authService.getAuthError());

  // Initialize user strictly from authoritative AuthService
  const [user, setUser] = useState<User | null>(() => sanitizeUserForClientSession(authService.getCurrentUser()));

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
        const sanitized = sanitizeUserForClientSession(authoritativeUser);
        setUser(sanitized);
        try {
          if (sanitized) {
            localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sanitized));
          }
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
        const sanitized = sanitizeUserForClientSession(e.detail);
        setUser(sanitized);
        try {
          if (sanitized) {
            localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sanitized));
          }
        } catch (err) {
          // Ignore
        }
      }
    };
    window.addEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
    return () => window.removeEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
  }, []);

  const isInitializing = authState === 'AUTH_INITIALIZING';
  const isProfileLoading = authState === 'AUTHENTICATED_PROFILE_LOADING';
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
      setUser(sanitizeUserForClientSession(result.user));
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

    // Auto-approved internal user
    setUser(sanitizeUserForClientSession(result.user));
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
    const safeUpdates = { ...updates };
    if (user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'AGENCY_OWNER') {
      delete (safeUpdates as any).customAgentMarginPercent;
      delete (safeUpdates as any).pricingSettings;
    }
    const updated = await authService.updateUserProfile(user.id, safeUpdates);
    if (updated) {
      const sanitized = sanitizeUserForClientSession(updated);
      setUser(sanitized);
      try {
        if (sanitized) {
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sanitized));
        }
      } catch (e) {
        // Ignore
      }
      return sanitized;
    }

    // Local fallback
    const fallbackUser = sanitizeUserForClientSession({
      ...user,
      ...safeUpdates
    });
    setUser(fallbackUser);
    try {
      if (fallbackUser) {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(fallbackUser));
      }
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
        isProfileLoading,
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
