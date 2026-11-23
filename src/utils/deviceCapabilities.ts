/**
 * Hardware, Network & Browser Capability Profiler for TheUnbound Portal.
 * Detects older PCs, low-RAM laptops, slower connections, and unsupported browser versions
 * so the UI can adapt gracefully without removing any business functionality.
 */

export type PerformanceTier = 'low' | 'standard';
export type DeviceCategory = 'Desktop' | 'Tablet' | 'Mobile';

export interface BrowserCompatibilityResult {
  supported: boolean;
  browserFamily: string;
  browserVersion: number | null;
  reason?: string;
}

export interface DeviceCapabilitiesProfile {
  perfTier: PerformanceTier;
  deviceCategory: DeviceCategory;
  browserFamily: string;
  browserVersion: number | null;
  browserSupported: boolean;
  browserNotice?: string;
  hardwareConcurrency: number | null;
  deviceMemoryGB: number | null;
  effectiveConnectionType: string;
  saveData: boolean;
  prefersReducedMotion: boolean;
  touchCapable: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Documented minimum supported browser baseline for TheUnbound B2B Portal.
 * Matches Vite build.target (ES2020 + modern CSS grid/flex/ResizeObserver).
 */
export const SUPPORTED_BROWSER_BASELINE = {
  Chrome: 87,
  Edge: 88,
  Firefox: 78,
  Safari: 14,
  Opera: 73,
} as const;

let cachedProfile: DeviceCapabilitiesProfile | null = null;

function parseBrowserFromUA(ua: string): { family: string; version: number | null } {
  if (!ua) return { family: 'Unknown', version: null };

  // Check Edge Chromium first (contains Chrome in UA)
  const edgeMatch = ua.match(/Edg(?:A|iOS)?\/(\d+)/);
  if (edgeMatch) return { family: 'Edge', version: parseInt(edgeMatch[1], 10) };

  // Legacy EdgeHTML
  const legacyEdge = ua.match(/Edge\/(\d+)/);
  if (legacyEdge) return { family: 'Edge', version: parseInt(legacyEdge[1], 10) };

  // IE 11 / Trident
  if (/MSIE\s|Trident\//i.test(ua)) {
    return { family: 'Internet Explorer', version: 11 };
  }

  // Opera
  const operaMatch = ua.match(/OPR\/(\d+)/);
  if (operaMatch) return { family: 'Opera', version: parseInt(operaMatch[1], 10) };

  // Firefox
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  if (firefoxMatch) return { family: 'Firefox', version: parseInt(firefoxMatch[1], 10) };

  // Chrome / CriOS
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/(\d+)/);
  if (chromeMatch) return { family: 'Chrome', version: parseInt(chromeMatch[1], 10) };

  // Safari
  const safariMatch = ua.match(/Version\/(\d+)(?:\.\d+)?.*Safari/);
  if (safariMatch) return { family: 'Safari', version: parseInt(safariMatch[1], 10) };

  return { family: 'Other', version: null };
}

function detectDeviceCategory(ua: string, width: number): DeviceCategory {
  const isTabletUA =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua)) ||
    (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 1);

  if (isTabletUA || (width >= 640 && width < 1024 && typeof window !== 'undefined' && 'ontouchstart' in window)) {
    return 'Tablet';
  }

  const isMobileUA = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua);
  if (isMobileUA || (width > 0 && width < 640)) {
    return 'Mobile';
  }

  return 'Desktop';
}

export function checkBrowserCompatibility(uaInput?: string): BrowserCompatibilityResult {
  const ua = uaInput ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const { family, version } = parseBrowserFromUA(ua);

  if (family === 'Internet Explorer') {
    return {
      supported: false,
      browserFamily: family,
      browserVersion: version,
      reason: 'Internet Explorer is no longer supported. Please use Chrome 87+, Edge 88+, Firefox 78+, or Safari 14+.'
    };
  }

  const minVersion = SUPPORTED_BROWSER_BASELINE[family as keyof typeof SUPPORTED_BROWSER_BASELINE];
  if (minVersion && version !== null && version < minVersion) {
    return {
      supported: false,
      browserFamily: family,
      browserVersion: version,
      reason: `${family} ${version} is older than our supported baseline (${family} ${minVersion}+). Some layouts or exports may be slower.`
    };
  }

  // Runtime feature check for critical Web APIs used by the portal
  if (typeof window !== 'undefined') {
    const missingCoreFeatures =
      typeof Promise === 'undefined' ||
      typeof Promise.allSettled !== 'function' ||
      typeof Intl === 'undefined' ||
      typeof URLSearchParams === 'undefined';

    if (missingCoreFeatures) {
      return {
        supported: false,
        browserFamily: family,
        browserVersion: version,
        reason: 'Your browser is missing required modern web features. Please update Chrome, Edge, Firefox, or Safari for the best experience.'
      };
    }
  }

  return {
    supported: true,
    browserFamily: family,
    browserVersion: version
  };
}

export function getDeviceCapabilities(forceRefresh = false): DeviceCapabilitiesProfile {
  if (cachedProfile && !forceRefresh) {
    return cachedProfile;
  }

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      perfTier: 'standard',
      deviceCategory: 'Desktop',
      browserFamily: 'Server',
      browserVersion: null,
      browserSupported: true,
      hardwareConcurrency: null,
      deviceMemoryGB: null,
      effectiveConnectionType: 'unknown',
      saveData: false,
      prefersReducedMotion: false,
      touchCapable: false,
      viewportWidth: 1440,
      viewportHeight: 900
    };
  }

  const ua = navigator.userAgent || '';
  const navAny = navigator as any;
  const conn = navAny.connection || navAny.mozConnection || navAny.webkitConnection;
  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : null;
  const deviceMemoryGB =
    typeof navAny.deviceMemory === 'number' && navAny.deviceMemory > 0
      ? navAny.deviceMemory
      : null;
  const effectiveConnectionType = typeof conn?.effectiveType === 'string' ? conn.effectiveType : 'unknown';
  const saveData = Boolean(conn?.saveData);
  const prefersReducedMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const touchCapable = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  const viewportWidth = window.innerWidth || 1440;
  const viewportHeight = window.innerHeight || 900;

  const compat = checkBrowserCompatibility(ua);
  const deviceCategory = detectDeviceCategory(ua, viewportWidth);

  // Classify older/entry-level PCs, low-RAM laptops, and constrained mobile networks as 'low' tier
  // so expensive GPU backdrop-blur and high-DPI canvas scales adapt automatically.
  const isLowCpu = hardwareConcurrency !== null && hardwareConcurrency <= 4;
  const isLowRam = deviceMemoryGB !== null && deviceMemoryGB <= 4;
  const isSlowNetwork = saveData || effectiveConnectionType === 'slow-2g' || effectiveConnectionType === '2g' || effectiveConnectionType === '3g';

  const perfTier: PerformanceTier =
    prefersReducedMotion || isLowRam || (isLowCpu && (deviceCategory !== 'Desktop' || isSlowNetwork)) || (hardwareConcurrency !== null && hardwareConcurrency <= 2)
      ? 'low'
      : 'standard';

  cachedProfile = {
    perfTier,
    deviceCategory,
    browserFamily: compat.browserFamily,
    browserVersion: compat.browserVersion,
    browserSupported: compat.supported,
    browserNotice: compat.reason,
    hardwareConcurrency,
    deviceMemoryGB,
    effectiveConnectionType,
    saveData,
    prefersReducedMotion,
    touchCapable,
    viewportWidth,
    viewportHeight
  };

  return cachedProfile;
}

export function isLowSpecDevice(): boolean {
  return getDeviceCapabilities().perfTier === 'low';
}

export function isConstrainedNetwork(): boolean {
  const profile = getDeviceCapabilities();
  return (
    profile.saveData ||
    profile.effectiveConnectionType === 'slow-2g' ||
    profile.effectiveConnectionType === '2g' ||
    profile.effectiveConnectionType === '3g'
  );
}

/**
 * Adaptive PDF rasterization scale factor:
 * Uses 1.5x on low-RAM / older dual-core PCs (cuts peak canvas memory by 44% and CPU time ~40%
 * while keeping A4 typography sharp and readable) and 2.0x on standard/high-spec devices.
 */
export function getAdaptivePdfScale(): number {
  const profile = getDeviceCapabilities();
  if (
    profile.perfTier === 'low' ||
    (profile.deviceMemoryGB !== null && profile.deviceMemoryGB <= 4) ||
    (profile.hardwareConcurrency !== null && profile.hardwareConcurrency <= 4)
  ) {
    return 1.5;
  }
  return 2;
}

/**
 * Initializes document-level performance attributes on boot.
 */
export function initDeviceCapabilities(): DeviceCapabilitiesProfile {
  const profile = getDeviceCapabilities(true);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.perfTier = profile.perfTier;
    document.documentElement.dataset.deviceCategory = profile.deviceCategory.toLowerCase();
  }
  return profile;
}
