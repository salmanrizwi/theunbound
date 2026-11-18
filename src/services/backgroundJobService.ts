import { performanceMonitor } from './performanceMonitor';
import { withBoundedTimeout } from './quotationOperationsService';

export type BackgroundJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BackgroundJobRecord<T = any> {
  jobId: string;
  idempotencyKey: string;
  jobType: 'PDF_EXPORT' | 'EXCEL_EXPORT' | 'CSV_EXPORT' | 'EMAIL_DISPATCH' | 'ADMIN_REPORT' | 'BULK_OPERATION';
  label: string;
  status: BackgroundJobStatus;
  progressPercent: number;
  attempts: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: T;
}

/**
 * Yields back to the browser event loop so painting/user clicks remain responsive
 * between heavy multi-page PDF renders or batch calculations.
 */
export function yieldToMainThread(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((globalThis as any).scheduler?.yield) {
    return (globalThis as any).scheduler.yield();
  }
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

class BackgroundJobService {
  private static instance: BackgroundJobService;
  private jobs: BackgroundJobRecord[] = [];
  private inFlightByIdempotencyKey: Map<string, Promise<any>> = new Map();
  private subscribers: Set<() => void> = new Set();
  private readonly maxHistory = 40;

  private constructor() {}

  public static getInstance(): BackgroundJobService {
    if (!BackgroundJobService.instance) {
      BackgroundJobService.instance = new BackgroundJobService();
    }
    return BackgroundJobService.instance;
  }

  public subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify(): void {
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch {}
    });
  }

  public getJobs(): BackgroundJobRecord[] {
    return [...this.jobs];
  }

  public getActiveJobs(): BackgroundJobRecord[] {
    return this.jobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING');
  }

  /**
   * Enqueues and runs a heavy task asynchronously with idempotency deduplication, bounded timeout, and retry.
   */
  public async enqueue<T>(params: {
    idempotencyKey: string;
    jobType: BackgroundJobRecord['jobType'];
    label: string;
    maxRetries?: number;
    timeoutMs?: number;
    task: (updateProgress: (pct: number) => void) => Promise<T>;
  }): Promise<T> {
    const existingFlight = this.inFlightByIdempotencyKey.get(params.idempotencyKey);
    if (existingFlight) {
      return existingFlight as Promise<T>;
    }

    const maxRetries = params.maxRetries ?? 1;
    const timeoutMs = params.timeoutMs ?? 45000;
    const job: BackgroundJobRecord<T> = {
      jobId: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      idempotencyKey: params.idempotencyKey,
      jobType: params.jobType,
      label: params.label,
      status: 'QUEUED',
      progressPercent: 0,
      attempts: 0,
      maxRetries,
      createdAt: new Date().toISOString()
    };

    this.jobs.unshift(job);
    if (this.jobs.length > this.maxHistory) {
      this.jobs.length = this.maxHistory;
    }
    this.notify();

    const updateProgress = (pct: number) => {
      job.progressPercent = Math.max(0, Math.min(100, Math.round(pct)));
      this.notify();
    };

    const runner = (async (): Promise<T> => {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      job.status = 'PROCESSING';
      job.startedAt = new Date().toISOString();
      this.notify();

      // Defer one tick so spinner/button loading state paints immediately before heavy work
      await yieldToMainThread();

      let lastErr: any = null;
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        job.attempts = attempt;
        try {
          const result = await withBoundedTimeout(
            params.task(updateProgress),
            timeoutMs,
            params.label
          );
          job.status = 'COMPLETED';
          job.progressPercent = 100;
          job.completedAt = new Date().toISOString();
          job.result = result;
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
          performanceMonitor.recordTiming(
            params.jobType === 'PDF_EXPORT' ? 'PDF_GENERATION' : 'EXPORT_JOB',
            params.label,
            elapsed,
            { jobId: job.jobId, attempts: attempt }
          );
          this.notify();
          return result;
        } catch (err: any) {
          lastErr = err;
          if (attempt <= maxRetries) {
            await new Promise(res => setTimeout(res, 250 * attempt));
          }
        }
      }

      job.status = 'FAILED';
      job.error = lastErr?.message || 'Background job execution failed';
      job.completedAt = new Date().toISOString();
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      performanceMonitor.recordTiming('EXPORT_JOB', `${params.label} (Failed)`, elapsed, {
        jobId: job.jobId,
        error: job.error
      });
      this.notify();
      throw lastErr;
    })();

    this.inFlightByIdempotencyKey.set(params.idempotencyKey, runner);
    try {
      return await runner;
    } finally {
      this.inFlightByIdempotencyKey.delete(params.idempotencyKey);
    }
  }
}

export const backgroundJobService = BackgroundJobService.getInstance();
