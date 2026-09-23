import { User } from '../types';
import { canUserAccessQuoteBuilder, canUserAccessCMS, canUserAccessB2BInventory } from './permissionEngine';

export type PortalNamespace = 'PUBLIC' | 'B2B' | 'ADMIN' | 'BUYER';

export interface ParsedRoute {
  namespace: PortalNamespace;
  pathname: string;
  subTab?: string;
  param?: string;
  rawPath: string;
}

const STORAGE_INTENDED_PATH = 'theunbound_intended_path';

/**
 * Normalizes both window.location.pathname and window.location.hash
 * Supports clean URLs like /b2b/quote-builder and hash URLs like #/b2b/quote-builder
 */
export function getCurrentPath(): string {
  if (typeof window === 'undefined') return '/';

  // Check hash first (if hash contains a path like #/b2b or #admin)
  const hash = window.location.hash.replace(/^#\/?/, '/');
  if (hash && hash !== '/') {
    // If hash starts with b2b or admin, normalize
    const cleanHash = hash.startsWith('/') ? hash : `/${hash}`;
    return cleanHash;
  }

  // Fallback to pathname
  const pathname = window.location.pathname || '/';
  return pathname;
}

/**
 * Parses any path into portal namespace and sub-routes
 */
export function parseRoute(pathString?: string): ParsedRoute {
  const path = (pathString || getCurrentPath()).trim();
  const normalized = path.startsWith('/') ? path : `/${path}`;

  // ADMIN / CMS Namespace
  if (normalized.startsWith('/admin') || normalized.startsWith('/cms')) {
    const segments = normalized.replace(/^\/(admin|cms)\/?/, '').split('/').filter(Boolean);
    return {
      namespace: 'ADMIN',
      pathname: normalized,
      subTab: segments[0] || 'dashboard',
      param: segments[1],
      rawPath: normalized
    };
  }

  // B2B Namespace
  if (normalized.startsWith('/b2b')) {
    const segments = normalized.replace(/^\/b2b\/?/, '').split('/').filter(Boolean);
    let subTab = segments[0] || 'home';
    let param = segments[1];

    // Canonical redirect for Assigned Leads:
    // Any legacy route (/b2b/leads, /b2b/assigned-leads) redirects to canonical /b2b/crm
    if (subTab === 'leads' || subTab === 'assigned-leads') {
      subTab = 'crm';
      param = 'assigned-leads';
    } else if (subTab === 'customers') {
      subTab = 'crm';
      param = 'clients';
    }

    return {
      namespace: 'B2B',
      pathname: (segments[0] === 'leads' || segments[0] === 'assigned-leads') ? '/b2b/crm' : normalized,
      subTab,
      param,
      rawPath: normalized
    };
  }

  // Handle Legacy Standalone Assigned Leads or Leads routes
  if (normalized.startsWith('/assigned-leads') || normalized.startsWith('/leads')) {
    return {
      namespace: 'B2B',
      pathname: '/b2b/crm',
      subTab: 'crm',
      param: 'assigned-leads',
      rawPath: normalized
    };
  }

  // PUBLIC Namespace (Single authoritative public portal / logged-out homepage)
  const segments = normalized.replace(/^\//, '').split('/').filter(Boolean);
  const first = (segments[0] || '').toLowerCase();

  // Redirect legacy buyer and alternate home routes directly to canonical home (/)
  if (
    first === 'buyer' || 
    first === 'buyers' || 
    first === 'buyer-landing' || 
    first === 'landing' || 
    first === 'portal' || 
    first === 'customer' || 
    first === 'customers' ||
    first === 'home' ||
    first === 'homepage' ||
    first === 'admin-home' ||
    first === 'agent-home' ||
    first === 'buyer-home' ||
    first === 'authenticated-home' ||
    first === 'dashboard-home'
  ) {
    return {
      namespace: 'PUBLIC',
      pathname: '/',
      subTab: 'destinations',
      param: 'all',
      rawPath: normalized
    };
  }

  let subTab = 'destinations';
  let param: string | undefined = undefined;

  if (first === 'destinations' || first === 'destination') {
    subTab = 'destinations';
    param = segments[1] || 'all';
  } else if (first === 'visas') {
    subTab = 'visas';
  } else if (first === 'contact') {
    subTab = 'contact';
  } else if (first === 'about') {
    subTab = 'about';
  } else if (first === 'page' || first === 'pages') {
    subTab = 'page';
    param = segments[1];
  } else if (first === 'blogs') {
    subTab = 'blogs';
  } else if (first === 'terms') {
    subTab = 'terms';
  } else if (first === 'privacy') {
    subTab = 'privacy';
  } else if (first === 'refund') {
    subTab = 'refund';
  } else if (first === 'cookies' || first === 'cookie-policy') {
    subTab = 'cookies';
  } else if (first === 'dashboard' || first === 'account') {
    // Legacy dashboard/account routes redirect based on authenticated portal
    subTab = first;
  } else if (!first) {
    subTab = 'destinations';
    param = 'all';
  } else {
    subTab = first;
  }

  return {
    namespace: 'PUBLIC',
    pathname: normalized,
    subTab,
    param,
    rawPath: normalized
  };
}

/**
 * Stores the intended destination before prompting for authentication
 */
export function setIntendedPath(path: string): void {
  try {
    sessionStorage.setItem(STORAGE_INTENDED_PATH, path);
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Retrieves the stored intended destination
 */
export function getIntendedPath(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_INTENDED_PATH);
  } catch (e) {
    return null;
  }
}

/**
 * Clears the stored intended destination
 */
export function clearIntendedPath(): void {
  try {
    sessionStorage.removeItem(STORAGE_INTENDED_PATH);
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Resolves post-login redirection with strict security overrides (Requirement #15)
 */
export function resolvePostLoginDestination(user: User, intendedPath?: string | null): string {
  const target = intendedPath || getIntendedPath();
  clearIntendedPath();

  const role = user.role;

  // 1. B2B AGENT LOGIN -> Immediately redirect to B2B Agent Portal
  if (role === 'B2B_AGENT' || role === 'AGENT') {
    if (target && target.startsWith('/b2b')) {
      // Security Check: If requesting Quote Builder, verify permission
      if (target.includes('/b2b/quote-builder') || target.includes('/b2b/create-quote')) {
        const canQuote = canUserAccessQuoteBuilder(user, 'B2B').allowed;
        return canQuote ? '/b2b/quote-builder' : '/b2b/dashboard';
      }
      return target;
    }
    // Default B2B Agent landing
    return '/b2b';
  }

  // 2. ADMIN / INTERNAL STAFF LOGIN -> Immediately redirect to Admin CMS
  if (role === 'ADMIN' || role === 'TEAM_MEMBER' || role === 'DMC_STAFF') {
    if (target && (target.startsWith('/admin') || target.startsWith('/cms'))) {
      return target;
    }
    return '/admin';
  }

  // 3. LEGACY / UNSUPPORTED BUYER ACCESS -> Redirect to public home
  return '/';
}

export interface RouteAccessResult {
  allowed: boolean;
  reason?: 'AUTH_REQUIRED' | 'ACCESS_RESTRICTED' | 'QUOTE_BUILDER_PERMISSION_DENIED';
  message?: string;
  redirectPath?: string;
}

/**
 * Enforces role-based route access guards (Requirements #9, #10)
 */
export function validateRouteAccess(user: User | null, pathString?: string): RouteAccessResult {
  const route = parseRoute(pathString);
  const isAuthenticated = !!user;

  // Block any legacy or cached accounts with BUYER role across all routes
  if (isAuthenticated && (user.role === 'BUYER' || (user as any).userType === 'BUYER')) {
    return {
      allowed: false,
      reason: 'ACCESS_RESTRICTED',
      message: 'Direct buyer accounts are not supported. TheUnbound operates exclusively for authorized B2B travel partners.',
      redirectPath: '/'
    };
  }

  // 1. PUBLIC / UNPROTECTED ROUTES (Single Public Homepage & Destination Catalogs)
  // Public marketing, destination catalogs, policies, and itineraries are globally accessible.
  // Authenticated administrators and B2B agents are permitted to navigate public pages or browser history
  // without encountering false ACCESS_RESTRICTED blocks or unwanted redirects.
  if (route.namespace === 'PUBLIC' || route.namespace === 'BUYER') {
    return { 
      allowed: true
    };
  }

  // 2. B2B AGENT PORTAL ROUTES (/b2b/*)
  if (route.namespace === 'B2B') {
    if (!isAuthenticated) {
      setIntendedPath(route.pathname);
      return {
        allowed: false,
        reason: 'AUTH_REQUIRED',
        message: 'Authentication required to access the wholesale B2B Agent Portal.',
        redirectPath: '/login'
      };
    }

    // Only verified, approved B2B Agents (and authorized operations staff) can access
    const b2bAccess = canUserAccessB2BInventory(user);
    if (!b2bAccess.allowed) {
      return {
        allowed: false,
        reason: 'ACCESS_RESTRICTED',
        message: b2bAccess.message || 'The B2B Agent Portal is restricted to verified travel partners and tour operators.',
        redirectPath: user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' ? '/admin' : '/'
      };
    }

    // Check B2B Quote Builder specific permission
    if (route.subTab === 'quote-builder' || route.subTab === 'create-quote') {
      const quoteAccess = canUserAccessQuoteBuilder(user, 'B2B');
      if (!quoteAccess.allowed) {
        return {
          allowed: false,
          reason: 'QUOTE_BUILDER_PERMISSION_DENIED',
          message: 'Your account does not have permission to access the B2B Quote Builder. Please contact DMC administration.',
          redirectPath: '/b2b/dashboard'
        };
      }
    }

    return { allowed: true };
  }

  // 3. ADMIN CMS ROUTES (/admin/*, /cms/*)
  if (route.namespace === 'ADMIN') {
    if (!isAuthenticated) {
      setIntendedPath(route.pathname);
      return {
        allowed: false,
        reason: 'AUTH_REQUIRED',
        message: 'Administrative authentication required to access TheUnbound DMC CMS.',
        redirectPath: '/login'
      };
    }

    const hasCMS = canUserAccessCMS(user);
    if (!hasCMS) {
      return {
        allowed: false,
        reason: 'ACCESS_RESTRICTED',
        message: 'Administrative operations access restricted to authorized TheUnbound ground staff and master administrators.',
        redirectPath: user.role === 'B2B_AGENT' || user.role === 'AGENT' ? '/b2b' : '/'
      };
    }

    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Programmatic navigation helper that synchronizes window location and dispatches events
 */
export function navigateTo(path: string, options?: { replace?: boolean }): void {
  if (typeof window === 'undefined') return;

  const normalized = path.startsWith('/') ? path : `/${path}`;

  try {
    if (options?.replace) {
      window.history.replaceState({}, '', normalized);
    } else {
      window.history.pushState({}, '', normalized);
    }
  } catch (e) {
    // If pushState is blocked or cross-origin, fallback to hash
    window.location.hash = `#${normalized}`;
  }

  window.dispatchEvent(new CustomEvent('theunbound_route_changed', { detail: { path: normalized } }));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
