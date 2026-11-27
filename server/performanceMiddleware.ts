import { Request, Response, NextFunction, Router } from 'express';
import zlib from 'zlib';
import {
  extractBearerToken,
  getServerFirestoreBaseUrl,
  verifyServerFirebaseIdToken
} from './firebaseServerAuth';

interface RouteStatBucket {
  count: number;
  errorCount: number;
  durations: number[];
  maxMs: number;
  lastStatus: number;
  lastSeenAt: string;
}

interface CacheCounter {
  hits: number;
  misses: number;
}

const MAX_DURATIONS_PER_ROUTE = 200;
const MAX_TRACKED_ROUTES = 80;

class ServerPerformanceTelemetry {
  private startedAt = Date.now();
  private totalApiRequests = 0;
  private totalApiErrors = 0;
  private activeRequests = 0;
  private peakConcurrentRequests = 0;
  private rateLimitBlocked = 0;
  private compressedResponses = 0;
  private rawBytesBeforeCompression = 0;
  private compressedBytesAfter = 0;
  private routes = new Map<string, RouteStatBucket>();
  private caches = new Map<string, CacheCounter>();

  public recordRequestStart(): void {
    this.activeRequests += 1;
    if (this.activeRequests > this.peakConcurrentRequests) {
      this.peakConcurrentRequests = this.activeRequests;
    }
  }

  public recordRequestEnd(method: string, routePath: string, statusCode: number, durationMs: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.totalApiRequests += 1;
    const isError = statusCode >= 400;
    if (isError) this.totalApiErrors += 1;

    const normalizedPath = normalizeApiRoutePath(routePath);
    const key = `${method.toUpperCase()} ${normalizedPath}`;

    let bucket = this.routes.get(key);
    if (!bucket) {
      if (this.routes.size >= MAX_TRACKED_ROUTES) {
        const oldestKey = this.routes.keys().next().value;
        if (oldestKey) this.routes.delete(oldestKey);
      }
      bucket = {
        count: 0,
        errorCount: 0,
        durations: [],
        maxMs: 0,
        lastStatus: statusCode,
        lastSeenAt: new Date().toISOString()
      };
      this.routes.set(key, bucket);
    }

    const cleanMs = Number(Math.max(0, durationMs).toFixed(2));
    bucket.count += 1;
    if (isError) bucket.errorCount += 1;
    if (cleanMs > bucket.maxMs) bucket.maxMs = cleanMs;
    bucket.lastStatus = statusCode;
    bucket.lastSeenAt = new Date().toISOString();
    bucket.durations.push(cleanMs);
    if (bucket.durations.length > MAX_DURATIONS_PER_ROUTE) {
      bucket.durations.shift();
    }
  }

  public recordCompression(rawBytes: number, compressedBytes: number): void {
    if (rawBytes <= 0 || compressedBytes <= 0) return;
    this.compressedResponses += 1;
    this.rawBytesBeforeCompression += rawBytes;
    this.compressedBytesAfter += compressedBytes;
  }

  public recordRateLimitBlock(): void {
    this.rateLimitBlocked += 1;
  }

  public recordCacheHit(cacheName: string): void {
    const entry = this.caches.get(cacheName) || { hits: 0, misses: 0 };
    entry.hits += 1;
    this.caches.set(cacheName, entry);
  }

  public recordCacheMiss(cacheName: string): void {
    const entry = this.caches.get(cacheName) || { hits: 0, misses: 0 };
    entry.misses += 1;
    this.caches.set(cacheName, entry);
  }

  public getSnapshot() {
    const routeMetrics = Array.from(this.routes.entries())
      .map(([route, b]) => {
        const sorted = [...b.durations].sort((a, bVal) => a - bVal);
        const sum = sorted.reduce((acc, v) => acc + v, 0);
        const p95Idx = sorted.length > 0 ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
        return {
          route,
          count: b.count,
          errorCount: b.errorCount,
          errorRatePercent: b.count > 0 ? Number(((b.errorCount / b.count) * 100).toFixed(2)) : 0,
          avgMs: sorted.length > 0 ? Number((sum / sorted.length).toFixed(1)) : 0,
          p95Ms: sorted.length > 0 ? Number(sorted[p95Idx].toFixed(1)) : 0,
          maxMs: Number(b.maxMs.toFixed(1)),
          lastStatus: b.lastStatus,
          lastSeenAt: b.lastSeenAt
        };
      })
      .sort((a, b) => b.p95Ms - a.p95Ms)
      .slice(0, 25);

    const cacheMetrics = Array.from(this.caches.entries()).map(([name, c]) => {
      const total = c.hits + c.misses;
      return {
        name,
        hits: c.hits,
        misses: c.misses,
        hitRatePercent: total > 0 ? Number(((c.hits / total) * 100).toFixed(1)) : 0
      };
    });

    const mem = process.memoryUsage();
    const bytesSaved = Math.max(0, this.rawBytesBeforeCompression - this.compressedBytesAfter);
    const savingsPercent =
      this.rawBytesBeforeCompression > 0
        ? Number(((bytesSaved / this.rawBytesBeforeCompression) * 100).toFixed(1))
        : 0;

    return {
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      totalApiRequests: this.totalApiRequests,
      totalApiErrors: this.totalApiErrors,
      apiErrorRatePercent:
        this.totalApiRequests > 0
          ? Number(((this.totalApiErrors / this.totalApiRequests) * 100).toFixed(2))
          : 0,
      activeRequests: this.activeRequests,
      peakConcurrentRequests: this.peakConcurrentRequests,
      rateLimitBlocked: this.rateLimitBlocked,
      compression: {
        responsesCompressed: this.compressedResponses,
        rawKB: Number((this.rawBytesBeforeCompression / 1024).toFixed(1)),
        compressedKB: Number((this.compressedBytesAfter / 1024).toFixed(1)),
        savedKB: Number((bytesSaved / 1024).toFixed(1)),
        savingsPercent
      },
      serverMemoryMB: {
        rssMB: Number((mem.rss / (1024 * 1024)).toFixed(1)),
        heapUsedMB: Number((mem.heapUsed / (1024 * 1024)).toFixed(1)),
        heapTotalMB: Number((mem.heapTotal / (1024 * 1024)).toFixed(1))
      },
      caches: cacheMetrics,
      routes: routeMetrics,
      generatedAt: new Date().toISOString()
    };
  }
}

function normalizeApiRoutePath(rawPath: string): string {
  const clean = (rawPath || '/').split('?')[0];
  return clean
    .replace(/\/[0-9a-f]{8,}(?=\/|$)/gi, '/:id')
    .replace(/\/[a-z]+-[a-z0-9_-]{5,}(?=\/|$)/gi, '/:id');
}

export const serverPerformanceTelemetry = new ServerPerformanceTelemetry();

export function recordServerCacheHit(cacheName: string): void {
  serverPerformanceTelemetry.recordCacheHit(cacheName);
}

export function recordServerCacheMiss(cacheName: string): void {
  serverPerformanceTelemetry.recordCacheMiss(cacheName);
}

const COMPRESSIBLE_CONTENT_TYPES = /^(text\/|application\/javascript|application\/x-javascript|application\/json|application\/xml|image\/svg\+xml)/i;
const MIN_COMPRESS_BYTES = 1024;

/**
 * Zero-dependency HTTP Brotli / Gzip response compression middleware using Node's native zlib.
 * Cuts JavaScript, CSS, HTML, and JSON payload transfer sizes by ~70-80% over the wire,
 * dramatically speeding up initial load on slower internet connections and mobile networks.
 */
export function createCompressionMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'HEAD') {
      next();
      return;
    }

    const acceptEncoding = String(req.headers['accept-encoding'] || '').toLowerCase();
    const useBrotli = acceptEncoding.includes('br') && typeof zlib.brotliCompressSync === 'function';
    const useGzip = !useBrotli && acceptEncoding.includes('gzip');

    if (!useBrotli && !useGzip) {
      next();
      return;
    }

    const encoding = useBrotli ? 'br' : 'gzip';
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    const chunks: Buffer[] = [];
    let bypassed = false;

    const shouldCompress = (): boolean => {
      if (res.getHeader('Content-Encoding')) return false;
      const status = res.statusCode || 200;
      if (status < 200 || status === 204 || status === 304) return false;
      const contentType = String(res.getHeader('Content-Type') || '');
      if (!contentType) return false;
      return COMPRESSIBLE_CONTENT_TYPES.test(contentType);
    };

    (res as any).write = (chunk: any, enc?: any, cb?: any): boolean => {
      if (bypassed) {
        return origWrite(chunk, enc, cb);
      }
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof enc === 'string' ? (enc as BufferEncoding) : 'utf8'));
      }
      if (typeof enc === 'function') enc();
      else if (typeof cb === 'function') cb();
      return true;
    };

    (res as any).end = (chunk?: any, enc?: any, cb?: any): Response => {
      if (bypassed) {
        return origEnd(chunk, enc, cb);
      }
      if (typeof chunk === 'function') {
        cb = chunk;
        chunk = undefined;
      } else if (typeof enc === 'function') {
        cb = enc;
        enc = undefined;
      }

      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof enc === 'string' ? (enc as BufferEncoding) : 'utf8'));
      }

      const body = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);

      if (body.length < MIN_COMPRESS_BYTES || !shouldCompress() || res.headersSent) {
        bypassed = true;
        return origEnd(body, cb);
      }

      try {
        const compressed = useBrotli
          ? zlib.brotliCompressSync(body, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 4
              }
            })
          : zlib.gzipSync(body, { level: 6 });

        if (compressed.length < body.length) {
          res.removeHeader('Content-Length');
          res.setHeader('Content-Encoding', encoding);
          const existingVary = String(res.getHeader('Vary') || '');
          if (!existingVary.toLowerCase().includes('accept-encoding')) {
            res.setHeader('Vary', existingVary ? `${existingVary}, Accept-Encoding` : 'Accept-Encoding');
          }
          res.setHeader('Content-Length', String(compressed.length));
          serverPerformanceTelemetry.recordCompression(body.length, compressed.length);
          bypassed = true;
          return origEnd(compressed, cb);
        }
      } catch {
        // Fall back safely to uncompressed response
      }

      bypassed = true;
      return origEnd(body, cb);
    };

    next();
  };
}

/**
 * Tracks API request latency, status codes, error rate, and concurrent request count.
 */
export function createApiTelemetryMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startNs = process.hrtime.bigint();
    serverPerformanceTelemetry.recordRequestStart();

    let recorded = false;
    const finalize = () => {
      if (recorded) return;
      recorded = true;
      const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      serverPerformanceTelemetry.recordRequestEnd(
        req.method,
        req.originalUrl || req.path || '/api',
        res.statusCode || 200,
        elapsedMs
      );
    };

    res.on('finish', finalize);
    res.on('close', finalize);
    next();
  };
}

/**
 * Lightweight sliding-window per-IP rate limiter for /api/* routes.
 * Configured generously (300 req / 60s per IP) so shared agency offices work smoothly
 * while protecting backend services from runaway client retry storms or abuse.
 */
export function createApiRateLimiter(options?: { windowMs?: number; maxRequests?: number }) {
  const windowMs = options?.windowMs ?? 60_000;
  const maxRequests = options?.maxRequests ?? 300;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const prune = (now: number) => {
    if (buckets.size < 250) return;
    for (const [ip, entry] of buckets.entries()) {
      if (now >= entry.resetAt) {
        buckets.delete(ip);
      }
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Always allow health checks
    if (req.path === '/health' || req.originalUrl === '/api/health') {
      next();
      return;
    }

    const now = Date.now();
    prune(now);

    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const clientIp = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';

    let entry = buckets.get(clientIp);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(clientIp, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > maxRequests) {
      serverPerformanceTelemetry.recordRateLimitBlock();
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before retrying.',
        retryAfterSeconds: retryAfterSec
      });
      return;
    }

    next();
  };
}

const AUTHORIZED_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

export async function verifyAdminBearerToken(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const bearer = extractBearerToken(req);
  if (!bearer.ok) {
    return bearer;
  }
  const idToken = bearer.idToken;

  const verified = await verifyServerFirebaseIdToken(idToken);
  if (!verified.ok) {
    return verified;
  }
  const { uid, email } = verified.token;

  try {
    if (AUTHORIZED_ADMIN_EMAILS.has(email)) {
      return { ok: true };
    }

    // Verify internal staff/admin role from Firestore user record
    const userDocUrl = `${getServerFirestoreBaseUrl()}/users/${encodeURIComponent(uid)}`;
    const userRes = await fetch(userDocUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000)
    });
    if (userRes.ok) {
      const userJson: any = await userRes.json();
      const roleVal = String(userJson?.fields?.role?.stringValue || '').toUpperCase();
      if (roleVal === 'ADMIN' || roleVal === 'SUPER_ADMIN' || roleVal === 'TEAM_MEMBER' || roleVal === 'DMC_STAFF') {
        return { ok: true };
      }
    }
    return { ok: false, status: 403, error: 'Administrator access required.' };
  } catch {
    return { ok: false, status: 503, error: 'Unable to verify administrator credentials.' };
  }
}

/**
 * Admin-only performance telemetry router: GET /api/admin/performance
 */
export function createAdminPerformanceRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const authCheck = await verifyAdminBearerToken(req);
    if (authCheck.ok === false && 'status' in authCheck) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }
    return res.json(serverPerformanceTelemetry.getSnapshot());
  });

  return router;
}
