import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import http from 'node:http';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { checkBrowserCompatibility, SUPPORTED_BROWSER_BASELINE } from '../utils/deviceCapabilities';
import { performanceMonitor } from '../services/performanceMonitor';
import { canonicalImageService } from '../services/imageService';
import {
  createCompressionMiddleware,
  createApiRateLimiter,
  createApiTelemetryMiddleware,
  createAdminPerformanceRouter,
  serverPerformanceTelemetry
} from '../../server/performanceMiddleware';

function makeHttpRequest(
  port: number,
  reqPath: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method: 'GET',
        headers
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runAudit() {
  console.log('=== THEUNBOUND PERFORMANCE ENGINEERING AUDIT ===\n');

  // 1. Verify production dist/index.html initial assets (post-build)
  const distIndexPath = path.resolve(process.cwd(), 'dist', 'index.html');
  assert.ok(fs.existsSync(distIndexPath), 'dist/index.html must exist (run npm run build first)');
  const distHtml = fs.readFileSync(distIndexPath, 'utf-8');

  assert.ok(
    !distHtml.includes('vendor-pdf') && !distHtml.includes('jspdf') && !distHtml.includes('html2canvas'),
    'dist/index.html MUST NOT preload PDF libraries (jspdf/html2canvas) on initial page load'
  );

  const assetRefs = Array.from(distHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)).map(m => m[1]);
  assert.ok(assetRefs.length >= 3, 'Expected Vite asset references in dist/index.html');

  let totalRawBytes = 0;
  let totalGzipBytes = 0;
  let totalBrotliBytes = 0;
  let entryJsBytes = 0;

  console.log('1. Initial HTML-Referenced Assets (Measured from dist/index.html):');
  for (const rel of assetRefs) {
    const abs = path.resolve(process.cwd(), 'dist', rel.replace(/^\//, ''));
    const buf = fs.readFileSync(abs);
    const gz = zlib.gzipSync(buf, { level: 6 });
    const br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } });
    totalRawBytes += buf.length;
    totalGzipBytes += gz.length;
    totalBrotliBytes += br.length;
    if (/\/assets\/index-[^/]+\.js$/.test(rel)) {
      entryJsBytes = buf.length;
    }
    console.log(
      `   - ${rel}: raw ${(buf.length / 1024).toFixed(1)} KB | gzip ${(gz.length / 1024).toFixed(1)} KB | br ${(br.length / 1024).toFixed(1)} KB`
    );
  }
  console.log(
    `   TOTAL INITIAL PAYLOAD: raw ${(totalRawBytes / 1024).toFixed(1)} KB | gzip ${(totalGzipBytes / 1024).toFixed(1)} KB | br ${(totalBrotliBytes / 1024).toFixed(1)} KB`
  );
  assert.ok(
    totalRawBytes < 2900 * 1024,
    `Expected total initial uncompressed assets < 2900 KB (was 3725.8 KB baseline); got ${(totalRawBytes / 1024).toFixed(1)} KB`
  );
  assert.ok(
    entryJsBytes < 1450 * 1024,
    `Expected entry index.js < 1450 KB (was 1677.5 KB baseline); got ${(entryJsBytes / 1024).toFixed(1)} KB`
  );
  console.log('   [PASS] Zero PDF preloads & significant initial payload reduction verified.\n');

  // 2. Verify ImageService debounced persistence eliminates synchronous localStorage storm
  const mockStore = new Map<string, string>();
  let setItemCalls = 0;
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => mockStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        setItemCalls += 1;
        mockStore.set(k, v);
      },
      removeItem: (k: string) => mockStore.delete(k)
    },
    addEventListener: () => {}
  };
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;

  const t0 = performance.now();
  for (let i = 0; i < 200; i++) {
    canonicalImageService.extractAllImagesFromRecord(
      {
        id: `perf-prod-${i}`,
        name: `Perf Product ${i}`,
        imageUrl: `https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&q=80&sig=${i}`,
        images: [
          `https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&q=80&sig=${i}`,
          `https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80&sig=${i}a`,
          `https://images.unsplash.com/photo-1590559899731-a3f376ec4e22?w=1200&q=80&sig=${i}b`
        ]
      },
      'PRODUCT',
      `perf-prod-${i}`
    );
  }
  const syncLoopMs = performance.now() - t0;
  assert.equal(setItemCalls, 0, 'extractAllImagesFromRecord batch must NOT call synchronous localStorage.setItem inside hydration loop');
  canonicalImageService.flushPersistedRegistry();
  assert.equal(setItemCalls, 1, 'Flushing debounced image registry must perform exactly 1 coalesced write');

  // Repeated syncImage for unchanged record must be a no-op (0 additional writes)
  canonicalImageService.syncImage(
    'PRODUCT',
    'perf-prod-0',
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&q=80&sig=0',
    'PRIMARY'
  );
  canonicalImageService.flushPersistedRegistry();
  assert.equal(setItemCalls, 1, 'Unchanged syncImage call must skip localStorage writes');
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
  console.log(`2. [PASS] ImageService Hydration Batch (200 products x 3 images = 600 images): ${syncLoopMs.toFixed(1)} ms, 1 coalesced write (down from ~800 sync writes).\n`);

  // 3. Verify responsive image URL optimizer
  const sampleUnsplash = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop';
  const cardUrl = getOptimizedImageUrl(sampleUnsplash, 'card', { constrainedNetwork: false });
  const slowCardUrl = getOptimizedImageUrl(sampleUnsplash, 'card', { constrainedNetwork: true });
  const thumbUrl = getOptimizedImageUrl(sampleUnsplash, 'thumb', { constrainedNetwork: false });
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  assert.ok(cardUrl.includes('w=520') && cardUrl.includes('q=75'), `Expected card width 520 & q=75, got ${cardUrl}`);
  assert.ok(slowCardUrl.includes('w=374') && slowCardUrl.includes('q=65'), `Expected constrained width 374 & q=65, got ${slowCardUrl}`);
  assert.ok(thumbUrl.includes('w=240'), `Expected thumb width 240, got ${thumbUrl}`);
  assert.equal(getOptimizedImageUrl(dataUrl, 'card'), dataUrl, 'Data URLs must remain untouched');
  console.log('3. [PASS] Responsive thumbnail optimizer & slow-network scaling verified.\n');

  // 4. Verify browser compatibility baseline detection
  assert.equal(SUPPORTED_BROWSER_BASELINE.Chrome, 87);
  assert.equal(checkBrowserCompatibility('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36').supported, true);
  assert.equal(checkBrowserCompatibility('Mozilla/5.0 Chrome/87.0.0.0 Safari/537.36').supported, true);
  assert.equal(checkBrowserCompatibility('Mozilla/5.0 Chrome/72.0.0.0 Safari/537.36').supported, false);
  assert.equal(checkBrowserCompatibility('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)').supported, false);
  assert.equal(checkBrowserCompatibility('Mozilla/5.0 Version/15.4 Safari/605.1.15').supported, true);
  assert.equal(checkBrowserCompatibility('Mozilla/5.0 Version/12.1 Safari/605.1.15').supported, false);
  console.log('4. [PASS] Supported browser baseline & unsupported legacy browser detection verified.\n');

  // 5. Verify PerformanceMonitor route tracking, error capture & summary
  performanceMonitor.reset();
  performanceMonitor.recordTiming('ROUTE_SWITCH', '/b2b/products', 42.5);
  performanceMonitor.recordTiming('PDF_GENERATION', 'PDF:Q-1001', 1240);
  performanceMonitor.recordFrontendError('RUNTIME_ERROR', 'Sample non-PII diagnostic test', 'app.js');
  const summary = performanceMonitor.getSummary();
  assert.equal(summary.timings.ROUTE_SWITCH.count, 1);
  assert.equal(summary.timings.PDF_GENERATION.count, 1);
  assert.equal(summary.frontendErrorCount, 1);
  assert.ok(summary.slowestSamples[0].category === 'PDF_GENERATION');
  assert.ok(summary.alerts.some(a => a.metric === 'ERRORS'));
  performanceMonitor.reset();
  console.log('5. [PASS] PerformanceMonitor route timings, PDF timings, slowest ops, and error alerts verified.\n');

  // 6. Verify Backend Express middleware (Brotli/Gzip compression, telemetry, rate limiter, auth guard on /api/admin/performance)
  const testApp = express();
  testApp.use(createCompressionMiddleware());
  testApp.use('/api', createApiTelemetryMiddleware());
  testApp.use('/api', createApiRateLimiter({ windowMs: 60_000, maxRequests: 5 }));
  testApp.get('/api/payload', (_req, res) => {
    res.json({
      items: Array.from({ length: 120 }, (_, i) => ({
        id: `item-${i}`,
        name: `Japan Luxury Private Experience ${i}`,
        description: 'Authoritative B2B ground travel service with private guide and luxury vehicle.'
      }))
    });
  });
  testApp.use('/api/admin/performance', createAdminPerformanceRouter());

  const server = await new Promise<http.Server>((resolve) => {
    const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as any;
  const port = addr.port;

  try {
    // Test Brotli compression
    const brRes = await makeHttpRequest(port, '/api/payload', { 'Accept-Encoding': 'br, gzip' });
    assert.equal(brRes.status, 200);
    assert.equal(brRes.headers['content-encoding'], 'br', 'Expected Brotli content-encoding');
    const brDecoded = zlib.brotliDecompressSync(brRes.body).toString('utf-8');
    const brJson = JSON.parse(brDecoded);
    assert.equal(brJson.items.length, 120);
    const brRatio = (1 - brRes.body.length / Buffer.byteLength(brDecoded)) * 100;

    // Test Gzip compression
    const gzRes = await makeHttpRequest(port, '/api/payload', { 'Accept-Encoding': 'gzip' });
    assert.equal(gzRes.status, 200);
    assert.equal(gzRes.headers['content-encoding'], 'gzip', 'Expected Gzip content-encoding');
    const gzDecoded = zlib.gunzipSync(gzRes.body).toString('utf-8');
    assert.equal(JSON.parse(gzDecoded).items.length, 120);

    // Test /api/admin/performance rejects unauthenticated callers with 401
    const unauthRes = await makeHttpRequest(port, '/api/admin/performance');
    assert.equal(unauthRes.status, 401, 'Admin performance endpoint must reject unauthenticated callers with 401');

    // Test rate limiter triggers 429 after maxRequests=5
    await makeHttpRequest(port, '/api/payload');
    await makeHttpRequest(port, '/api/payload');
    const blockedRes = await makeHttpRequest(port, '/api/payload');
    assert.equal(blockedRes.status, 429, 'Rate limiter must return HTTP 429 when burst limit exceeded');

    const srvSnap = serverPerformanceTelemetry.getSnapshot();
    assert.ok(srvSnap.totalApiRequests >= 6);
    assert.ok(srvSnap.compression.responsesCompressed >= 2);
    assert.ok(srvSnap.rateLimitBlocked >= 1);

    console.log(
      `6. [PASS] Backend Middleware: Brotli savings ${brRatio.toFixed(1)}% (${Buffer.byteLength(brDecoded)}B -> ${brRes.body.length}B), Gzip verified, 401 auth guard verified, 429 rate limiter verified.\n`
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('=== ALL PERFORMANCE ENGINEERING AUDITS PASSED ===');
}

runAudit().catch((err) => {
  console.error('PERFORMANCE AUDIT FAILED:', err);
  process.exit(1);
});
