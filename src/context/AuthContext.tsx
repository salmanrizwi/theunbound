import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { AppDatabase } from '../services/db';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  role: UserRole;
  isAuthModalOpen: boolean;
  authModalReason: string;
  login: (email: string, role?: UserRole) => void;
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
        return JSON.parse(saved);
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
    if (user) {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    }
  }, [user]);

  const login = (email: string, role: UserRole = 'AGENT') => {
    const db = AppDatabase.getInstance();
    const existing = db.getUsers().find(u => u.email.toLowerCase() === (email || '').trim().toLowerCase());
    const demoProfile = DEMO_USERS[role] || DEMO_USERS.AGENT;
    const authenticatedUser: User = existing ? {
      ...existing,
      avatarUrl: existing.avatarUrl || demoProfile.avatarUrl
    } : {
      ...demoProfile,
      email: email || demoProfile.email
    };

    setUser(authenticatedUser);
    setIsAuthModalOpen(false);

    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  };

  const logout = () => {
    setUser(null);
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
