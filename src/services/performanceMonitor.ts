/**
 * Centralized Application Performance Monitoring & Diagnostics Service
 * Tracks timings, cache efficiency, active Firestore listeners, auto-save health,
 * and memory snapshots with zero network/Firestore overhead.
 */

import { getDeviceCapabilities, DeviceCapabilitiesProfile } from '../utils/deviceCapabilities';

export type PerfCategory =
  | 'APP_INIT'
  | 'ROUTE_SWITCH'
  | 'QUOTE_BUILDER_INIT'
  | 'QUOTE_STEP_SWITCH'
  | 'PRODUCT_SEARCH'
  | 'HOTEL_SEARCH'
  | 'PRICING_ENGINE'
  | 'SURCHARGE_ENGINE'
  | 'FX_ENGINE'
  | 'AUTO_SAVE'
  | 'PDF_GENERATION'
  | 'DB_QUERY'
  | 'DB_HYDRATION'
  | 'EXPORT_JOB';

export interface PerfSample {
  id: string;
  category: PerfCategory;
  label: string;
  durationMs: number;
  timestamp: string;
  meta?: Record<string, any>;
}

export interface CacheStat {
  hits: number;
  misses: number;
  evictions: number;
}

export interface AutoSaveHealthStat {
  totalSaves: number;
  succeeded: number;
  failed: number;
  retries: number;
  skippedNoDirty: number;
  conflictPrevented: number;
  lastDurationMs: number;
  avgDurationMs: number;
  lastError?: string;
  lastSavedAt?: string;
}

export interface WebVitalsSnapshot {
  lcpMs?: number;
  cls: number;
  inpMs?: number;
  fcpMs?: number;
  ttfbMs?: number;
  longTaskCount: number;
  totalBlockingMs: number;
  lastUpdatedAt?: string;
}

export interface CapturedFrontendError {
  id: string;
  type: 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION';
  message: string;
  source?: string;
  timestamp: string;
}

export interface PerfAlert {
  severity: 'WARN' | 'CRITICAL';
  metric: string;
  message: string;
  value: number;
  threshold: number;
}

class PerformanceMonitorService {
  private static instance: PerformanceMonitorService;
  private samples: PerfSample[] = [];
  private readonly maxSamples = 250;
  private cacheStats: Record<string, CacheStat> = {};
  private activeListenerLabels: Set<string> = new Set();
  private firestoreReadCount: number = 0;
  private firestoreWriteCount: number = 0;
  private autoSaveStat: AutoSaveHealthStat = {
    totalSaves: 0,
    succeeded: 0,
    failed: 0,
    retries: 0,
    skippedNoDirty: 0,
    conflictPrevented: 0,
    lastDurationMs: 0,
    avgDurationMs: 0
  };
  private webVitals: WebVitalsSnapshot = {
    cls: 0,
    longTaskCount: 0,
    totalBlockingMs: 0
  };
  private capturedErrors: CapturedFrontendError[] = [];
  private readonly maxErrors = 30;
  private vitalsInitialized = false;
  private errorTrackingInitialized = false;
  private observers: PerformanceObserver[] = [];
  private subscribers: Set<() => void> = new Set();
  private notifyTimer: any = null;

  private constructor() {}

  public static getInstance(): PerformanceMonitorService {
    if (!PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance = new PerformanceMonitorService();
    }
    return PerformanceMonitorService.instance;
  }

  public subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private scheduleNotify(): void {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.subscribers.forEach(cb => {
        try {
          cb();
        } catch {}
      });
    }, 500);
  }

  public recordTiming(
    category: PerfCategory,
    label: string,
    durationMs: number,
    meta?: Record<string, any>
  ): void {
    const cleanDuration = Number(Math.max(0, durationMs).toFixed(2));
    this.samples.unshift({
      id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      label,
      durationMs: cleanDuration,
      timestamp: new Date().toISOString(),
      meta
    });
    if (this.samples.length > this.maxSamples) {
      this.samples.length = this.maxSamples;
    }
    this.scheduleNotify();
  }

  public measureSync<T>(category: PerfCategory, label: string, fn: () => T, meta?: Record<string, any>): T {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      return fn();
    } finally {
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.recordTiming(category, label, t1 - t0, meta);
    }
  }

  public async measureAsync<T>(category: PerfCategory, label: string, fn: () => Promise<T>, meta?: Record<string, any>): Promise<T> {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      return await fn();
    } finally {
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.recordTiming(category, label, t1 - t0, meta);
    }
  }

  public recordCacheHit(cacheName: string): void {
    if (!this.cacheStats[cacheName]) {
      this.cacheStats[cacheName] = { hits: 0, misses: 0, evictions: 0 };
    }
    this.cacheStats[cacheName].hits++;
  }

  public recordCacheMiss(cacheName: string): void {
    if (!this.cacheStats[cacheName]) {
      this.cacheStats[cacheName] = { hits: 0, misses: 0, evictions: 0 };
    }
    this.cacheStats[cacheName].misses++;
  }

  public recordCacheEviction(cacheName: string): void {
    if (!this.cacheStats[cacheName]) {
      this.cacheStats[cacheName] = { hits: 0, misses: 0, evictions: 0 };
    }
    this.cacheStats[cacheName].evictions++;
  }

  public registerListener(label: string): void {
    this.activeListenerLabels.add(label);
    this.scheduleNotify();
  }

  public unregisterListener(label: string): void {
    this.activeListenerLabels.delete(label);
    this.scheduleNotify();
  }

  public getActiveListenerCount(): number {
    return this.activeListenerLabels.size;
  }

  public getActiveListenerLabels(): string[] {
    return Array.from(this.activeListenerLabels);
  }

  public recordFirestoreRead(docCount: number = 1): void {
    this.firestoreReadCount += Math.max(0, docCount);
  }

  public recordFirestoreWrite(docCount: number = 1): void {
    this.firestoreWriteCount += Math.max(0, docCount);
  }

  public recordAutoSave(
    outcome: 'SUCCESS' | 'FAILED' | 'RETRY' | 'SKIPPED' | 'CONFLICT_PREVENTED',
    durationMs: number = 0,
    error?: string
  ): void {
    if (outcome === 'SKIPPED') {
      this.autoSaveStat.skippedNoDirty++;
      return;
    }
    if (outcome === 'CONFLICT_PREVENTED') {
      this.autoSaveStat.conflictPrevented++;
      return;
    }
    if (outcome === 'RETRY') {
      this.autoSaveStat.retries++;
      return;
    }
    this.autoSaveStat.totalSaves++;
    if (outcome === 'SUCCESS') {
      this.autoSaveStat.succeeded++;
      this.autoSaveStat.lastDurationMs = Number(durationMs.toFixed(2));
      const n = this.autoSaveStat.succeeded;
      this.autoSaveStat.avgDurationMs = Number(
        (((this.autoSaveStat.avgDurationMs * (n - 1)) + durationMs) / n).toFixed(2)
      );
      this.autoSaveStat.lastSavedAt = new Date().toISOString();
      this.recordTiming('AUTO_SAVE', 'Quote Auto-Save', durationMs);
    } else {
      this.autoSaveStat.failed++;
      this.autoSaveStat.lastError = error || 'Unknown auto-save error';
      this.recordTiming('AUTO_SAVE', 'Quote Auto-Save Failed', durationMs, { error });
    }
    this.scheduleNotify();
  }

  public getCategoryMetrics(category: PerfCategory): {
    count: number;
    avgMs: number;
    p95Ms: number;
    maxMs: number;
    lastMs: number;
  } {
    const filtered = this.samples.filter(s => s.category === category);
    if (filtered.length === 0) {
      return { count: 0, avgMs: 0, p95Ms: 0, maxMs: 0, lastMs: 0 };
    }
    const durations = filtered.map(s => s.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, v) => acc + v, 0);
    const p95Idx = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));
    return {
      count: filtered.length,
      avgMs: Number((sum / filtered.length).toFixed(2)),
      p95Ms: Number(durations[p95Idx].toFixed(2)),
      maxMs: Number(durations[durations.length - 1].toFixed(2)),
      lastMs: filtered[0].durationMs
    };
  }

  public getMemoryUsageMB(): { usedJSHeapMB?: number; totalJSHeapMB?: number; limitMB?: number } {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const m = (performance as any).memory;
      return {
        usedJSHeapMB: Number((m.usedJSHeapSize / (1024 * 1024)).toFixed(1)),
        totalJSHeapMB: Number((m.totalJSHeapSize / (1024 * 1024)).toFixed(1)),
        limitMB: Number((m.jsHeapSizeLimit / (1024 * 1024)).toFixed(1))
      };
    }
    return {};
  }

  public initWebVitalsObserver(): void {
    if (this.vitalsInitialized || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return;
    }
    this.vitalsInitialized = true;

    try {
      const navEntries = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation') : [];
      if (navEntries.length > 0) {
        const nav = navEntries[0] as PerformanceNavigationTiming;
        if (typeof nav.responseStart === 'number' && nav.responseStart > 0) {
          this.webVitals.ttfbMs = Number(nav.responseStart.toFixed(1));
          this.webVitals.lastUpdatedAt = new Date().toISOString();
        }
      }
    } catch {}

    const supported = (PerformanceObserver as any).supportedEntryTypes as string[] | undefined;

    const observeType = (type: string, opts: Record<string, any>, handler: (entries: PerformanceEntry[]) => void) => {
      if (Array.isArray(supported) && !supported.includes(type)) return;
      try {
        const observer = new PerformanceObserver((list) => {
          handler(list.getEntries());
        });
        observer.observe(opts as any);
        this.observers.push(observer);
      } catch {}
    };

    observeType('paint', { type: 'paint', buffered: true }, (entries) => {
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          this.webVitals.fcpMs = Number(entry.startTime.toFixed(1));
          this.webVitals.lastUpdatedAt = new Date().toISOString();
        }
      }
    });

    observeType('largest-contentful-paint', { type: 'largest-contentful-paint', buffered: true }, (entries) => {
      const last = entries[entries.length - 1];
      if (last) {
        this.webVitals.lcpMs = Number(last.startTime.toFixed(1));
        this.webVitals.lastUpdatedAt = new Date().toISOString();
      }
    });

    observeType('layout-shift', { type: 'layout-shift', buffered: true }, (entries) => {
      for (const entry of entries as any[]) {
        if (!entry.hadRecentInput && typeof entry.value === 'number') {
          this.webVitals.cls = Number((this.webVitals.cls + entry.value).toFixed(4));
          this.webVitals.lastUpdatedAt = new Date().toISOString();
        }
      }
    });

    observeType('event', { type: 'event', durationThreshold: 40, buffered: true }, (entries) => {
      for (const entry of entries as any[]) {
        if (entry.interactionId && typeof entry.duration === 'number') {
          const rounded = Number(entry.duration.toFixed(1));
          if (this.webVitals.inpMs === undefined || rounded > this.webVitals.inpMs) {
            this.webVitals.inpMs = rounded;
            this.webVitals.lastUpdatedAt = new Date().toISOString();
          }
        }
      }
    });

    observeType('longtask', { type: 'longtask', buffered: true }, (entries) => {
      for (const entry of entries) {
        this.webVitals.longTaskCount++;
        const blocking = Math.max(0, entry.duration - 50);
        this.webVitals.totalBlockingMs = Number((this.webVitals.totalBlockingMs + blocking).toFixed(1));
        this.webVitals.lastUpdatedAt = new Date().toISOString();
      }
    });
  }

  public initGlobalErrorTracking(): void {
    if (this.errorTrackingInitialized || typeof window === 'undefined') return;
    this.errorTrackingInitialized = true;

    window.addEventListener('error', (event) => {
      const rawMessage = event?.message || (event?.error && event.error.message) || 'Unknown runtime error';
      // Privacy-safe sanitization: truncate and strip potential email/token strings
      const safeMsg = String(rawMessage)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]')
        .slice(0, 220);
      this.recordFrontendError('RUNTIME_ERROR', safeMsg, event?.filename ? String(event.filename).split('/').pop() : undefined);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason;
      const rawMessage = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unhandled promise rejection';
      const safeMsg = String(rawMessage)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]')
        .slice(0, 220);
      this.recordFrontendError('UNHANDLED_REJECTION', safeMsg);
    });
  }

  public recordFrontendError(
    type: 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION',
    message: string,
    source?: string
  ): void {
    this.capturedErrors.unshift({
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      message,
      source,
      timestamp: new Date().toISOString()
    });
    if (this.capturedErrors.length > this.maxErrors) {
      this.capturedErrors.length = this.maxErrors;
    }
    this.scheduleNotify();
  }

  public getWebVitals(): WebVitalsSnapshot {
    return { ...this.webVitals };
  }

  public getDeviceProfile(): DeviceCapabilitiesProfile {
    return getDeviceCapabilities();
  }

  public getSlowestSamples(limit = 10): PerfSample[] {
    return [...this.samples]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, limit);
  }

  public getAlerts(): PerfAlert[] {
    const alerts: PerfAlert[] = [];
    if (this.webVitals.lcpMs !== undefined && this.webVitals.lcpMs > 2500) {
      alerts.push({
        severity: this.webVitals.lcpMs > 4000 ? 'CRITICAL' : 'WARN',
        metric: 'LCP',
        message: 'Largest Contentful Paint exceeded target (2.5s)',
        value: this.webVitals.lcpMs,
        threshold: 2500
      });
    }
    if (this.webVitals.inpMs !== undefined && this.webVitals.inpMs > 200) {
      alerts.push({
        severity: this.webVitals.inpMs > 500 ? 'CRITICAL' : 'WARN',
        metric: 'INP',
        message: 'Interaction to Next Paint exceeded target (200ms)',
        value: this.webVitals.inpMs,
        threshold: 200
      });
    }
    if (this.webVitals.cls > 0.1) {
      alerts.push({
        severity: this.webVitals.cls > 0.25 ? 'CRITICAL' : 'WARN',
        metric: 'CLS',
        message: 'Cumulative Layout Shift exceeded target (0.10)',
        value: this.webVitals.cls,
        threshold: 0.1
      });
    }
    if (this.webVitals.totalBlockingMs > 300) {
      alerts.push({
        severity: this.webVitals.totalBlockingMs > 600 ? 'CRITICAL' : 'WARN',
        metric: 'TBT',
        message: 'Main-thread long task blocking exceeded 300ms',
        value: this.webVitals.totalBlockingMs,
        threshold: 300
      });
    }
    if (this.capturedErrors.length > 0) {
      alerts.push({
        severity: this.capturedErrors.length >= 5 ? 'CRITICAL' : 'WARN',
        metric: 'ERRORS',
        message: `${this.capturedErrors.length} unhandled frontend error(s) captured this session`,
        value: this.capturedErrors.length,
        threshold: 0
      });
    }
    return alerts;
  }

  public getSummary() {
    const cacheSummary = Object.entries(this.cacheStats).map(([name, stat]) => {
      const total = stat.hits + stat.misses;
      return {
        name,
        ...stat,
        hitRatePercent: total > 0 ? Number(((stat.hits / total) * 100).toFixed(1)) : 0
      };
    });

    const categories: PerfCategory[] = [
      'ROUTE_SWITCH',
      'QUOTE_BUILDER_INIT',
      'QUOTE_STEP_SWITCH',
      'PRODUCT_SEARCH',
      'HOTEL_SEARCH',
      'PRICING_ENGINE',
      'SURCHARGE_ENGINE',
      'FX_ENGINE',
      'AUTO_SAVE',
      'PDF_GENERATION',
      'DB_QUERY',
      'DB_HYDRATION'
    ];

    const timings = Object.fromEntries(
      categories.map(cat => [cat, this.getCategoryMetrics(cat)])
    ) as Record<PerfCategory, ReturnType<PerformanceMonitorService['getCategoryMetrics']>>;

    return {
      timings,
      caches: cacheSummary,
      activeListeners: this.activeListenerLabels.size,
      activeListenerLabels: Array.from(this.activeListenerLabels),
      firestoreReads: this.firestoreReadCount,
      firestoreWrites: this.firestoreWriteCount,
      autoSave: { ...this.autoSaveStat },
      webVitals: { ...this.webVitals },
      memory: this.getMemoryUsageMB(),
      deviceProfile: this.getDeviceProfile(),
      alerts: this.getAlerts(),
      slowestSamples: this.getSlowestSamples(10),
      frontendErrors: this.capturedErrors.slice(0, 15),
      frontendErrorCount: this.capturedErrors.length,
      recentSamples: this.samples.slice(0, 30)
    };
  }

  public reset(): void {
    this.samples = [];
    this.cacheStats = {};
    this.firestoreReadCount = 0;
    this.firestoreWriteCount = 0;
    this.capturedErrors = [];
  }
}

export const performanceMonitor = PerformanceMonitorService.getInstance();
