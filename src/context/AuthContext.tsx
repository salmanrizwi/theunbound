import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, UserCategory, UserApprovalStatus } from '../types';
import { AppDatabase } from '../services/db';
import { authService, AuthResult, RegisterProfileData, normalizeEmail } from '../services/authService';
import { resolvePostLoginDestination, navigateTo, clearIntendedPath } from '../services/portalRouter';

export type { AuthResult, RegisterProfileData };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
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
  // Initialize user from cached session if available, immediately validated against Firebase Auth
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY_AUTH);
    if (saved) {
      try {
        const parsed: User = JSON.parse(saved);
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

  // Synchronize state with unified AuthService singleton and Firebase Auth state
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuth((authoritativeUser) => {
      if (authoritativeUser) {
        console.log('[AUTH] Syncing authoritative user profile into state:', authoritativeUser.email, 'Role:', authoritativeUser.role);
        setUser(authoritativeUser);
        try {
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(authoritativeUser));
        } catch (e) {
          // Ignore
        }
      } else {
        // Only clear if authService explicitly confirmed no user
        const currentFbUser = authService.getCurrentFirebaseUser();
        if (currentFbUser === null) {
          setUser(null);
          try {
            localStorage.removeItem(STORAGE_KEY_AUTH);
          } catch (e) {
            // Ignore
          }
        }
      }
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
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(e.detail));
        } catch (err) {
          // Ignore
        }
      }
    };
    window.addEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
    return () => window.removeEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
  }, []);

  /**
   * Universal Login Handler
   * Authenticates against Firebase Authentication, then loads Firestore /users/{uid} profile.
   * Works identically across desktop, tablet, and mobile browsers.
   */
  const login = async (email: string, role: UserRole = 'B2B_AGENT', password?: string): Promise<AuthResult> => {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your registered email address.' };
    }

    const result = await authService.login(cleanEmail, password, role);

    if (result.success && result.user) {
      setUser(result.user);
      try {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(result.user));
      } catch (e) {
        // Ignore
      }
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
   * Eliminates local-only registration discrepancies across devices.
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
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(result.user));
    } catch (e) {
      // Ignore
    }
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
    await authService.logout();
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
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(updated));
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
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(fallbackUser));
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
    if (user) {
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
        isAuthenticated: !!user,
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
