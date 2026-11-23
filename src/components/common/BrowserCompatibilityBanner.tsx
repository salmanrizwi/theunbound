import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { getDeviceCapabilities } from '../../utils/deviceCapabilities';

const DISMISS_KEY = 'theunbound_browser_compat_dismissed_v1';

/**
 * Lightweight, non-blocking compatibility notice shown ONLY on unsupported legacy browsers
 * below the documented baseline (Chrome 87+, Edge 88+, Firefox 78+, Safari 14+).
 */
export const BrowserCompatibilityBanner: React.FC = () => {
  const profile = getDeviceCapabilities();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (profile.browserSupported || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore storage failure
    }
  };

  return (
    <div
      role="status"
      className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-900 text-xs flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="font-medium leading-snug">
          <span className="font-bold">Browser Update Recommended: </span>
          {profile.browserNotice ||
            'For optimal speed and reliable PDF/quote rendering, please use Chrome 87+, Edge 88+, Firefox 78+, or Safari 14+.'}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss browser notice"
        className="p-1 rounded-lg hover:bg-amber-100 text-amber-700 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
