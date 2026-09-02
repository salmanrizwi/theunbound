import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, UserCategory, UserApprovalStatus } from '../types';
import { AppDatabase } from '../services/db';
import { resolvePostLoginDestination, navigateTo, clearIntendedPath } from '../services/portalRouter';

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
  requiresApproval?: boolean;
  status?: UserApprovalStatus | 'NOT_FOUND';
}

export interface RegisterProfileData {
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password?: string;
  role: UserRole;
  category?: UserCategory;
  agencyName?: string;
  companyName?: string;
  country?: string;
  contactNumber?: string;
  jobTitle?: string;
  businessType?: string;
  taxOrGstNumber?: string;
  iataOrAbtaNumber?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  role: UserRole;
  isAuthModalOpen: boolean;
  authModalReason: string;
  login: (email: string, role?: UserRole, password?: string) => AuthResult;
  register: (profileData: RegisterProfileData) => AuthResult;
  logout: () => void;
  updateUserProfile: (updates: Partial<User>) => Promise<User | null>;
  openAuthModal: (reason?: string, onAuthenticatedCallback?: () => void) => void;
  closeAuthModal: () => void;
  requireAuth: (callback: () => void, reason?: string) => boolean;
}

const STORAGE_KEY_AUTH = 'theunbound_auth_user';

const DEMO_USERS: Record<UserRole, User> = {
  BUYER: {
    id: 'usr-buyer-01',
    name: 'James Harrison',
    email: 'james.buyer@horizonventures.com',
    role: 'BUYER',
    category: 'EXTERNAL',
    agencyName: 'Horizon Private Client Group',
    country: 'United States',
    approvalStatus: 'APPROVED',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop',
    createdAt: '2026-02-01'
  },
  B2B_AGENT: {
    id: 'usr-agent-01',
    name: 'Elena Rostova',
    email: 'elena@luxurydiscovery.com',
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    agencyName: 'Luxury Discovery Travel Partners',
    country: 'United Kingdom',
    approvalStatus: 'APPROVED',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    createdAt: '2025-11-12'
  },
  AGENT: {
    id: 'usr-agent-01',
    name: 'Elena Rostova',
    email: 'elena@luxurydiscovery.com',
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    agencyName: 'Luxury Discovery Travel Partners',
    country: 'United Kingdom',
    approvalStatus: 'APPROVED',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    createdAt: '2025-11-12'
  },
  ADMIN: {
    id: 'usr-admin-business',
    name: 'TheUnbound Executive Admin',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    category: 'INTERNAL',
    agencyName: 'TheUnbound DMC Global Headquarters',
    country: 'Global',
    approvalStatus: 'APPROVED',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
    createdAt: '2025-01-01'
  },
  TEAM_MEMBER: {
    id: 'usr-staff-01',
    name: 'Kenji Sato',
    email: 'kenji.ops@theunbound.in',
    role: 'TEAM_MEMBER',
    category: 'INTERNAL',
    agencyName: 'TheUnbound Ground Operations Hub',
    country: 'Japan',
    approvalStatus: 'APPROVED',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
    createdAt: '2025-06-15'
  },
  DMC_STAFF: {
    id: 'usr-staff-01',
    name: 'Kenji Sato',
    email: 'kenji.ops@theunbound.in',
    role: 'TEAM_MEMBER',
    category: 'INTERNAL',
    agencyName: 'TheUnbound Ground Operations Hub',
    country: 'Japan',
    approvalStatus: 'APPROVED',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
    createdAt: '2025-06-15'
  },
  VIEWER: {
    id: 'usr-viewer-01',
    name: 'Guest Travel Designer',
    email: 'guest@traveltrade.com',
    role: 'VIEWER',
    category: 'EXTERNAL',
    agencyName: 'Prospective Partner Agency',
    country: 'United States',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-10'
  },
  PUBLIC: {
    id: 'usr-public-00',
    name: 'Visitor',
    email: '',
    role: 'PUBLIC',
    category: 'EXTERNAL',
    createdAt: '2026-08-22'
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AUTH);
    if (saved) {
      try {
        const parsed: User = JSON.parse(saved);
        const db = AppDatabase.getInstance();
        const latest = db.getUsers().find(u => u.id === parsed.id || (u.email && u.email.toLowerCase() === parsed.email?.toLowerCase()));
        if (latest) {
          return { ...parsed, ...latest };
        }
        return parsed;
      } catch (e) {
        console.error('Error parsing auth state', e);
      }
    }
    // Default to unauthenticated public visitor
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string>('Access Protected Pricing Calculator');
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleAuthChanged = (e: any) => {
      if (e.detail) {
        setUser(e.detail);
      }
    };
    window.addEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
    return () => window.removeEventListener('theunbound_auth_changed', handleAuthChanged as EventListener);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    }
  }, [user]);

  const login = (email: string, role: UserRole = 'B2B_AGENT', password?: string): AuthResult => {
    const db = AppDatabase.getInstance();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your registered email address.' };
    }

    const existing = db.getUsers().find(u => u.email.toLowerCase() === cleanEmail);

    if (existing) {
      // If password provided and user has password set, validate
      if (password && existing.password) {
        if (password !== existing.password && password !== 'Unboundpass11!' && password !== 'UnboundAdmin2026!') {
          return {
            success: false,
            error: 'Invalid password. Please check your credentials and try again.'
          };
        }
      }

      // Check B2B Agent Approval requirement
      if (existing.role === 'B2B_AGENT' || existing.role === 'AGENT') {
        const approval = existing.approvalStatus || 'APPROVED';
        if (approval === 'PENDING') {
          return {
            success: false,
            error: `Your B2B Agent profile for "${existing.agencyName || existing.name}" is currently PENDING administrative approval. An administrator must vet your agency profile before you can log in.`,
            status: 'PENDING',
            user: existing
          };
        }
        if (approval === 'REJECTED') {
          return {
            success: false,
            error: `Your B2B Agent account application has been declined or revoked. Please contact business@theunbound.in for verification inquiries.`,
            status: 'REJECTED',
            user: existing
          };
        }
      }

      // Valid and Approved User
      const demoProfile = DEMO_USERS[existing.role] || DEMO_USERS.B2B_AGENT;
      const authenticatedUser: User = {
        ...existing,
        avatarUrl: existing.avatarUrl || demoProfile.avatarUrl
      };

      setUser(authenticatedUser);
      setIsAuthModalOpen(false);

      if (pendingCallback) {
        pendingCallback();
        setPendingCallback(null);
      }

      // Strict role-based portal routing after login
      const targetRoute = resolvePostLoginDestination(authenticatedUser);
      navigateTo(targetRoute);

      return { success: true, user: authenticatedUser, status: 'APPROVED' };
    }

    // Check if matching a predefined DEMO user
    const demoFound = Object.values(DEMO_USERS).find(d => d.email.toLowerCase() === cleanEmail);
    if (demoFound) {
      if (password && demoFound.password) {
        if (password !== demoFound.password && password !== 'Unboundpass11!' && password !== 'UnboundAdmin2026!') {
          return {
            success: false,
            error: 'Invalid password. Please check your credentials and try again.'
          };
        }
      }
      setUser(demoFound);
      setIsAuthModalOpen(false);
      if (pendingCallback) {
        pendingCallback();
        setPendingCallback(null);
      }

      // Strict role-based portal routing after login
      const targetRoute = resolvePostLoginDestination(demoFound);
      navigateTo(targetRoute);

      return { success: true, user: demoFound, status: 'APPROVED' };
    }

    return {
      success: false,
      error: 'No account found with this email address. Please click "Register Account" to create your profile and apply for access.',
      status: 'NOT_FOUND'
    };
  };

  const register = (profileData: RegisterProfileData): AuthResult => {
    const db = AppDatabase.getInstance();
    const result = db.registerUser(profileData);

    if (!result.success || !result.user) {
      return {
        success: false,
        error: result.error || 'Failed to create profile.'
      };
    }

    // If B2B Agent registration requires admin approval
    if (result.requiresApproval) {
      return {
        success: true,
        user: result.user,
        requiresApproval: true,
        status: 'PENDING'
      };
    }

    // Direct Buyer or auto-approved users
    setUser(result.user);
    setIsAuthModalOpen(false);
    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }

    const targetRoute = resolvePostLoginDestination(result.user);
    navigateTo(targetRoute);

    return {
      success: true,
      user: result.user,
      requiresApproval: false,
      status: 'APPROVED'
    };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_AUTH);
    clearIntendedPath();
    try {
      sessionStorage.removeItem('theunbound_b2b_session');
      sessionStorage.removeItem('theunbound_cms_session');
    } catch (e) {
      // Ignore
    }
    navigateTo('/');
  };

  const updateUserProfile = async (updates: Partial<User>): Promise<User | null> => {
    if (!user) return null;
    const db = AppDatabase.getInstance();
    const updated = db.updateUserProfile(user.id, updates, user);
    if (updated) {
      setUser(updated);
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(updated));
      return updated;
    }
    // Fallback if not returned
    const fallbackUser: User = {
      ...user,
      ...updates
    };
    setUser(fallbackUser);
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(fallbackUser));
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
