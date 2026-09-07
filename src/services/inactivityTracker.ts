/**
 * TheUnbound DMC - 24-Hour Inactivity Auto-Logout Tracker
 * 
 * Tracks meaningful user interaction across desktop, tablet, and mobile devices:
 * - Mouse movement (throttled)
 * - Mouse clicks and down events
 * - Keyboard interactions
 * - Touch interactions
 * - Scroll events
 * - Visibility change
 * 
 * Survives page refreshes via non-sensitive timestamp in localStorage.
 * Automatically triggers sign-out when 24 hours of continuous inactivity elapses.
 */

const STORAGE_KEY_LAST_ACTIVE = 'theunbound_auth_last_active_at';
export const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds
const RECORD_THROTTLE_MS = 30 * 1000; // Throttle storage writes to at most once per 30 seconds
const CHECK_INTERVAL_MS = 30 * 1000; // Check inactivity status every 30 seconds

class InactivityTracker {
  private static instance: InactivityTracker;
  private lastRecordedTime: number = Date.now();
  private checkIntervalId: any = null;
  private onTimeoutCallback: (() => void) | null = null;
  private isTrackingActive: boolean = false;

  private constructor() {
    // Read initial time or initialize
    if (typeof window !== 'undefined') {
      const stored = this.getLastActivity();
      this.lastRecordedTime = stored;
    }
  }

  public static getInstance(): InactivityTracker {
    if (!InactivityTracker.instance) {
      InactivityTracker.instance = new InactivityTracker();
    }
    return InactivityTracker.instance;
  }

  /**
   * Retrieves the last recorded activity timestamp from localStorage.
   * Returns current timestamp if not found.
   */
  public getLastActivity(): number {
    if (typeof window === 'undefined') return Date.now();
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[INACTIVITY] Storage read error:', e);
    }
    return Date.now();
  }

  /**
   * Records user activity (throttled to avoid performance impact).
   */
  public recordActivity(): void {
    const now = Date.now();
    // Only update storage if at least 30 seconds have elapsed since last write
    if (now - this.lastRecordedTime >= RECORD_THROTTLE_MS) {
      this.lastRecordedTime = now;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
        } catch (e) {
          // Ignore storage write errors (e.g. private browsing quota)
        }
      }
    }
  }

  /**
   * Checks whether the user has been inactive for 24 hours or more.
   */
  public isInactive(): boolean {
    const now = Date.now();
    const lastActive = this.getLastActivity();
    const elapsed = now - lastActive;
    const isExceeded = elapsed >= INACTIVITY_TIMEOUT_MS;
    if (isExceeded) {
      console.warn(`[INACTIVITY] 24-hour inactivity timeout reached. Inactive for ${Math.round(elapsed / 1000 / 60)} minutes.`);
    }
    return isExceeded;
  }

  /**
   * Resets the activity timestamp to the current moment.
   */
  public reset(): void {
    const now = Date.now();
    this.lastRecordedTime = now;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, now.toString());
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Clears the stored activity timestamp on logout.
   */
  public clear(): void {
    this.lastRecordedTime = Date.now();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Event handler for DOM interaction events
   */
  private handleUserInteraction = () => {
    this.recordActivity();
  };

  /**
   * Starts tracking user activity and monitoring the 24-hour timeout.
   */
  public start(onTimeout: () => void): void {
    this.onTimeoutCallback = onTimeout;

    if (this.isTrackingActive) return;
    this.isTrackingActive = true;

    if (typeof window === 'undefined') return;

    // Check immediately if already expired
    if (this.isInactive()) {
      onTimeout();
      return;
    }

    // Attach passive event listeners to window
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'visibilitychange'];
    events.forEach(eventName => {
      window.addEventListener(eventName, this.handleUserInteraction, { passive: true });
    });

    // Start periodic check timer
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    this.checkIntervalId = setInterval(() => {
      if (this.isInactive()) {
        console.warn('[INACTIVITY] Periodic check: user has been inactive for >= 24 hours.');
        if (this.onTimeoutCallback) {
          this.onTimeoutCallback();
        }
      }
    }, CHECK_INTERVAL_MS);

    console.log('[INACTIVITY] Inactivity monitoring started (24h timeout window).');
  }

  /**
   * Stops tracking user activity and cleans up event listeners and intervals.
   */
  public stop(): void {
    if (!this.isTrackingActive) return;
    this.isTrackingActive = false;

    if (typeof window !== 'undefined') {
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'visibilitychange'];
      events.forEach(eventName => {
        window.removeEventListener(eventName, this.handleUserInteraction);
      });
    }

    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    this.onTimeoutCallback = null;
    console.log('[INACTIVITY] Inactivity monitoring stopped.');
  }
}

export const inactivityTracker = InactivityTracker.getInstance();
