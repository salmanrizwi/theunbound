import type {
  DemoBookingButtonConfig,
  HomepageDemoBookingConfig
} from '../types';

export interface CalendlyUrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
}

export interface DemoBookingPublishValidationResult {
  valid: boolean;
  errors: string[];
  buttonErrors: Record<string, string>;
}

const DISALLOWED_URL_CHARS = /[\s<>"'`\\]/;

/**
 * Strictly validates that a URL is a legitimate HTTPS Calendly booking URL.
 * Rejects empty strings, non-HTTPS protocols, javascript:/data: schemes,
 * embedded credentials, non-Calendly domains, and bare root URLs without a scheduling path.
 */
export function validateCalendlyUrl(rawUrl?: string | null): CalendlyUrlValidationResult {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'A Calendly booking URL is required when this button is enabled.'
    };
  }

  if (DISALLOWED_URL_CHARS.test(trimmed)) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'URL contains invalid whitespace or unsafe characters.'
    };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Unsafe URL scheme is not allowed.'
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Enter a valid full URL starting with https://calendly.com/...'
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Calendly booking links must use HTTPS (https://calendly.com/...).'
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'URLs with embedded credentials are not permitted.'
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isCalendlyHost =
    hostname === 'calendly.com' ||
    hostname === 'www.calendly.com' ||
    (hostname.endsWith('.calendly.com') && hostname.length > '.calendly.com'.length);

  if (!isCalendlyHost) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Only legitimate Calendly scheduling URLs (calendly.com) are accepted.'
    };
  }

  // Require at least one non-empty path segment (e.g. /theunbound/demo or /d/abc-def)
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Include the specific Calendly scheduling path (e.g., https://calendly.com/your-team/demo).'
    };
  }

  // Reject path traversal
  if (segments.some(seg => seg === '.' || seg === '..')) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'URL path contains invalid traversal segments.'
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString()
  };
}

/**
 * Validates the Demo Booking section configuration before publishing to Firestore.
 * Prevents broken CTAs from being published while allowing disabled buttons to stay unconfigured.
 */
export function validateDemoBookingConfigForPublish(
  config: HomepageDemoBookingConfig
): DemoBookingPublishValidationResult {
  const errors: string[] = [];
  const buttonErrors: Record<string, string> = {};

  if (!config.headline || !config.headline.trim()) {
    errors.push('Main headline is required.');
  }

  if (!Array.isArray(config.buttons) || config.buttons.length !== 2) {
    errors.push('Demo Booking section must contain exactly two button configurations.');
    return { valid: false, errors, buttonErrors };
  }

  const seenIds = new Set<string>();
  for (const btn of config.buttons) {
    if (!btn.id || seenIds.has(btn.id)) {
      errors.push('Each booking button must have a unique button ID.');
      continue;
    }
    seenIds.add(btn.id);

    if (btn.enabled) {
      if (!btn.label || !btn.label.trim()) {
        const msg = `Button ${btn.slot} is enabled but its label is empty.`;
        buttonErrors[btn.id] = msg;
        errors.push(msg);
        continue;
      }

      const urlCheck = validateCalendlyUrl(btn.calendlyUrl);
      if (!urlCheck.valid) {
        const msg = urlCheck.error || `Button ${btn.slot} requires a valid Calendly booking URL.`;
        buttonErrors[btn.id] = msg;
        errors.push(`Button ${btn.slot} ("${btn.label.trim()}"): ${msg}`);
      }
    } else if (btn.calendlyUrl && btn.calendlyUrl.trim().length > 0) {
      // If a URL was entered on a disabled button, validate it so invalid schemes aren't saved
      const urlCheck = validateCalendlyUrl(btn.calendlyUrl);
      if (!urlCheck.valid) {
        const msg = urlCheck.error || 'Invalid Calendly URL.';
        buttonErrors[btn.id] = msg;
        errors.push(`Button ${btn.slot} (disabled): ${msg}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    buttonErrors
  };
}

/**
 * Returns the ordered list of buttons safe to render on the live public homepage.
 * Disabled buttons and buttons with missing/invalid Calendly URLs are strictly excluded.
 */
export function getPublishableDemoBookingButtons(
  config?: HomepageDemoBookingConfig | null
): Array<DemoBookingButtonConfig & { validatedUrl: string }> {
  if (!config || !Array.isArray(config.buttons)) return [];

  return [...config.buttons]
    .sort((a, b) => (a.displayOrder ?? a.slot) - (b.displayOrder ?? b.slot))
    .reduce<Array<DemoBookingButtonConfig & { validatedUrl: string }>>((acc, btn) => {
      if (!btn.enabled) return acc;
      if (!btn.label || !btn.label.trim()) return acc;
      const check = validateCalendlyUrl(btn.calendlyUrl);
      if (!check.valid) return acc;
      acc.push({
        ...btn,
        validatedUrl: check.normalizedUrl
      });
      return acc;
    }, []);
}

/**
 * Emits non-sensitive Google Analytics / dataLayer events when a visitor clicks
 * a published Demo Booking CTA button. Never transmits PII.
 */
export function trackDemoBookingClick(params: {
  sectionId: string;
  buttonId: string;
  buttonSlot: 1 | 2;
  displayOrder: number;
}): void {
  if (typeof window === 'undefined') return;

  const primaryEventName =
    params.buttonSlot === 1
      ? 'demo_booking_button_1_clicked'
      : 'demo_booking_button_2_clicked';

  const safePayload = {
    section_id: params.sectionId,
    button_id: params.buttonId,
    button_slot: params.buttonSlot,
    display_order: params.displayOrder,
    event_category: 'homepage_demo_booking'
  };

  try {
    const gtagFn = (window as any).gtag;
    if (typeof gtagFn === 'function') {
      gtagFn('event', primaryEventName, safePayload);
      gtagFn('event', 'demo_booking_link_opened', safePayload);
    } else if (Array.isArray((window as any).dataLayer)) {
      (window as any).dataLayer.push({
        event: primaryEventName,
        ...safePayload
      });
      (window as any).dataLayer.push({
        event: 'demo_booking_link_opened',
        ...safePayload
      });
    }
  } catch {
    // Non-blocking: analytics must never disrupt navigation
  }
}
