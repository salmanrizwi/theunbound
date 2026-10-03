import { User } from '../types';
import { canUserAccessQuoteBuilder, canUserAccessCMS, canUserAccessB2BInventory } from './permissionEngine';
import { authDiagnostic } from './authDiagnostic';

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
    const rawSegments = normalized.replace(/^\/(admin|cms)\/?/, '').split('/').filter(Boolean);
    let subTab = rawSegments[0] || 'dashboard';
    let param = rawSegments[1];

    // Normalize operations nested paths:
    // e.g. /admin/operations/visa-ancillary-services/travel-protection
    // /admin/operations/visa-ancillary/travel-protection
    // /admin/operations/visa/travel-protection
    // /admin/operations/travel-protection
    if (subTab === 'operations' && rawSegments[1]) {
      const second = rawSegments[1].toLowerCase().replace(/[-_]/g, '');
      if (second === 'visasancillary' || second === 'visaancillary' || second === 'visasancillaries' || second === 'visaancillaryservices' || second === 'visasancillaryservices' || second === 'visa' || second === 'visas' || second === 'ancillary' || second === 'ancillaries') {
        subTab = 'visas-ancillary';
        param = rawSegments[2] || 'visa_services';
      } else if (second === 'travelprotection' || second === 'protection' || second === 'insurance') {
        subTab = 'visas-ancillary';
        param = 'travel_protection';
      } else if (second === 'groundconnectivity' || second === 'ground' || second === 'vip' || second === 'vipground' || second === 'connectivity' || second === 'esim') {
        subTab = 'visas-ancillary';
        param = 'ground_connectivity';
      } else if (second === 'masterschemamatrix' || second === 'fieldparity' || second === 'schemamatrix' || second === 'matrix') {
        subTab = 'visas-ancillary';
        param = 'field_parity';
      } else if (second === 'visaservices' || second === 'visaservice') {
        subTab = 'visas-ancillary';
        param = 'visa_services';
      }
    }

    // Direct module aliases at /admin level:
    const firstClean = subTab.toLowerCase().replace(/[-_]/g, '');
    if (firstClean === 'travelprotection' || firstClean === 'protection' || firstClean === 'insurance') {
      subTab = 'visas-ancillary';
      param = 'travel_protection';
    } else if (firstClean === 'groundconnectivity' || firstClean === 'ground' || firstClean === 'connectivity' || firstClean === 'vipground' || firstClean === 'vip' || firstClean === 'esim') {
      subTab = 'visas-ancillary';
      param = 'ground_connectivity';
    } else if (firstClean === 'masterschemamatrix' || firstClean === 'fieldparity' || firstClean === 'schemamatrix' || firstClean === 'matrix') {
      subTab = 'visas-ancillary';
      param = 'field_parity';
    } else if (firstClean === 'visasancillary' || firstClean === 'visaancillary' || firstClean === 'visasancillaries' || firstClean === 'visaancillaries' || firstClean === 'visaancillaryservices' || firstClean === 'visasancillaryservices' || firstClean === 'visaservices' || firstClean === 'visaservice' || firstClean === 'visa' || firstClean === 'visas' || firstClean === 'ancillary' || firstClean === 'ancillaries') {
      subTab = 'visas-ancillary';
      if (!param) param = 'visa_services';
    }

    // Normalize param format (underscores for subTab matching)
    if (param) {
      const pClean = param.toLowerCase().replace(/[-_]/g, '');
      if (pClean === 'travelprotection' || pClean === 'protection' || pClean === 'insurance') {
        param = 'travel_protection';
      } else if (pClean === 'groundconnectivity' || pClean === 'ground' || pClean === 'connectivity' || pClean === 'vip' || pClean === 'vipground' || pClean === 'esim') {
        param = 'ground_connectivity';
      } else if (pClean === 'masterschemamatrix' || pClean === 'fieldparity' || pClean === 'schemamatrix' || pClean === 'matrix') {
        param = 'field_parity';
      } else if (pClean === 'visaservices' || pClean === 'visaservice' || pClean === 'visas' || pClean === 'visa') {
        param = 'visa_services';
      }
    }

    return {
      namespace: 'ADMIN',
      pathname: normalized,
      subTab,
      param,
      rawPath: normalized
    };
  }

  // B2B Namespace
  if (normalized.startsWith('/b2b')) {
    const segments = normalized.replace(/^\/b2b\/?/, '').split('/').filter(Boolean);
    let subTab = segments[0] || 'home';
    let param = segments[1];

    const firstClean = subTab.toLowerCase().replace(/[-_]/g, '');

    // Canonical redirect for Assigned Leads:
    // Any legacy route (/b2b/leads, /b2b/assigned-leads) redirects to canonical /b2b/crm
    if (subTab === 'leads' || subTab === 'assigned-leads') {
      subTab = 'crm';
      param = 'assigned-leads';
    } else if (subTab === 'customers') {
      subTab = 'crm';
      param = 'clients';
    } else if (firstClean === 'travelprotection' || firstClean === 'protection' || firstClean === 'insurance') {
      subTab = 'visa';
      param = 'PROTECTION';
    } else if (firstClean === 'groundconnectivity' || firstClean === 'ground' || firstClean === 'connectivity' || firstClean === 'esim' || firstClean === 'vip') {
      subTab = 'visa';
      param = 'GROUND';
    } else if (firstClean === 'visa' || firstClean === 'visas' || firstClean === 'visaservices' || firstClean === 'ancillary' || firstClean === 'ancillaries' || firstClean === 'visasancillary' || firstClean === 'visaancillary') {
      subTab = 'visa';
      if (!param || param === 'all') {
        param = 'ALL';
      } else {
        const pClean = param.toLowerCase().replace(/[-_]/g, '');
        if (pClean === 'travelprotection' || pClean === 'protection' || pClean === 'insurance') param = 'PROTECTION';
        else if (pClean === 'groundconnectivity' || pClean === 'ground' || pClean === 'connectivity' || pClean === 'esim' || pClean === 'vip') param = 'GROUND';
        else if (pClean === 'visaservices' || pClean === 'visaservice' || pClean === 'visa' || pClean === 'visas') param = 'VISA';
        else if (pClean === 'masterschemamatrix' || pClean === 'fieldparity' || pClean === 'schemamatrix' || pClean === 'matrix') {
          // Master Schema Matrix is internal CMS admin only; do not expose to B2B Agents
          param = 'ALL';
        } else param = 'ALL';
      }
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
  authDiagnostic.markStage('T10');

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
