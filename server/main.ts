import express from "express";
import path from "path";
import fs from "fs";
import { handleSitemapXml, handleRobotsTxt, injectSEOIntoHtml } from "./seoHandler";
import { createIntegrationsRouter } from "./integrationsService";
import { createFXRouter } from "./fxService";
import { createAdminUserRouter } from "./adminUserService";
import { createMarginGovernanceRouter } from "./marginGovernanceService";
import { createCashbackRouter, createAdminCashbackRouter, startCashbackScheduler } from "./cashbackService";
import { createNewsletterRouter } from "./newsletterService";
import { createB2BVisibilityRouter } from "./b2bVisibilityService";
import {
  createCompressionMiddleware,
  createApiTelemetryMiddleware,
  createApiRateLimiter,
  createAdminPerformanceRouter
} from "./performanceMiddleware";
import { createHomepageVideoRouter } from "./homepageVideoService";
import { createPromotionRouter, createAdminPromotionRouter } from "./promotionService";
import { createAdminBookingManualDiscountRouter } from "./bookingManualDiscountService";
import { createUserCartRouter, createAdminUserCartRouter } from "./userCartService";
import { createAdminSupplierAllocationRouter } from "./supplierAllocationService";

// Prevent unexpected unhandled crashes
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught Exception:', error);
});

let serverPromise: Promise<any> | null = null;

export async function startServer() {
  if (serverPromise) {
    return serverPromise;
  }

  serverPromise = new Promise(async (resolve, reject) => {
    try {
      const app = express();
      app.set('trust proxy', true);
      app.disable('x-powered-by');

      // Production HTTPS & browser transport security headers (preserves iframe compatibility)
      app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
        const hostHeader = (req.get('host') || '').toLowerCase();
        const isLocalhost = hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1');
        if (!isLocalhost && (req.secure || forwardedProto === 'https')) {
          res.setHeader('Strict-Transport-Security', 'max-age=31536000');
        }
        next();
      });

      // Transparent HTTP Brotli / Gzip compression for JS, CSS, HTML & JSON responses
      app.use(createCompressionMiddleware());

      app.use(express.json({ limit: '10mb' }));

      // API latency telemetry & generous sliding-window rate limiting
      app.use("/api", createApiTelemetryMiddleware());
      app.use("/api", createApiRateLimiter({ windowMs: 60_000, maxRequests: 300 }));

      // API routes FIRST
      app.get("/api/health", (req, res) => {
        res.json({ status: "ok", service: "theunbound-dmc-portal" });
      });

      // Admin-only backend performance & health telemetry endpoint
      app.use("/api/admin/performance", createAdminPerformanceRouter());

      // Admin-only Homepage YouTube URL validation endpoint
      app.use("/api/admin/homepage", createHomepageVideoRouter());

      // Strict B2B Portal Destination Visibility API
      app.use("/api/b2b", createB2BVisibilityRouter());

      // Secure Server-Side Integrations Router (Gmail, Google Sheets, Token Refresh)
      app.use("/api/integrations", createIntegrationsRouter());

      // Secure Server-Side Admin User Management Router (Deletion, Deactivation)
      app.use("/api/admin/users", createAdminUserRouter());

      // Secure Server-Side Margin & Commission Governance Router (Transactional Firestore Updates)
      app.use("/api/admin/margins", createMarginGovernanceRouter());

      // Secure Server-Side Cashback & Rewards Wallet Routers
      app.use("/api/cashback", createCashbackRouter());
      app.use("/api/admin/cashback", createAdminCashbackRouter());

      // Secure Server-Side Promotion Management & Redemption Routers
      app.use("/api/promotions", createPromotionRouter());
      app.use("/api/admin/promotions", createAdminPromotionRouter());

      // Secure Server-Side Admin Manual Discount Coupon & Margin Governance Router
      app.use("/api/admin", createAdminBookingManualDiscountRouter());

      // Strict UID-Scoped User Cart Isolation & Admin On-Behalf-Of Cart Routers
      app.use("/api/cart", createUserCartRouter());
      app.use("/api/admin", createAdminUserCartRouter());

      // Secure Server-Side Consolidated Supplier Allocation & Net Cost Governance Router
      app.use("/api/admin/supplier-allocations", createAdminSupplierAllocationRouter());

      // Centralized Live XE.com FX Currency Engine Router
      app.use("/api/fx", createFXRouter());

      // Public Newsletter Subscription Router (Sendy integration)
      app.use("/api/newsletter", createNewsletterRouter());

      // SEO Technical Endpoints
      app.get("/sitemap.xml", handleSitemapXml);
      app.get("/robots.txt", handleRobotsTxt);

      // Robust environment detection: in development mode or unless NODE_ENV === "production", mount Vite dev middlewares
      const distPath = fs.existsSync(path.resolve(process.cwd(), "dist")) ? path.resolve(process.cwd(), "dist") : path.resolve(process.cwd(), "build");
      const indexPath = path.join(distPath, "index.html");
      const hasDistBuild = fs.existsSync(indexPath);
      const isCompiledBundle = typeof __filename !== "undefined" && (__filename.endsWith("server.cjs") || __filename.endsWith("server.js"));
      const isDevScript = process.env.npm_lifecycle_event === "dev";
      const isRunningWithTsx = process.execArgv.some((a) => a.includes("tsx")) || 
                               process.argv.some((a) => a.includes("tsx"));
      const isDev = !isCompiledBundle && (isRunningWithTsx || isDevScript || (!hasDistBuild && process.env.NODE_ENV !== "production"));
      const isProduction = isCompiledBundle || process.env.NODE_ENV === "production" || !isDev;

      if (!isProduction) {
        // Initialize Vite asynchronously so Express binds port 3000 immediately on cold boot
        // and never trips container startup readiness probes.
        const vitePromise = import("vite").then(({ createServer: createViteServer }) =>
          createViteServer({
            server: { middlewareMode: true, hmr: false },
            appType: "custom",
          })
        );

        vitePromise.catch((err) => {
          console.error("[SERVER] Vite initialization failed:", err);
        });

        // Delegate non-API requests to Vite middlewares once ready
        app.use(async (req, res, next) => {
          if (req.originalUrl.startsWith("/api")) {
            return next();
          }
          try {
            const vite = await vitePromise;
            vite.middlewares(req, res, next);
          } catch (e) {
            next(e);
          }
        });

        // Handle HTML requests with SEO meta injection in development
        app.use(async (req, res, next) => {
          const url = req.originalUrl;
          // Skip API endpoints
          if (url.startsWith("/api")) {
            return next();
          }

          try {
            const vite = await vitePromise;
            const templatePath = path.resolve(process.cwd(), "index.html");
            let template = fs.readFileSync(templatePath, "utf-8");
            template = await vite.transformIndexHtml(url, template);
            const htmlWithSEO = injectSEOIntoHtml(template, url, req.get("host") || "theunbound.in");
            res.status(200).set({ "Content-Type": "text/html" }).end(htmlWithSEO);
          } catch (e: any) {
            try {
              const vite = await vitePromise;
              vite.ssrFixStacktrace(e);
            } catch {
              // ignore
            }
            next(e);
          }
        });
      } else {
        const bundledDir = typeof __dirname !== "undefined" && fs.existsSync(path.join(__dirname, "index.html"))
          ? __dirname
          : distPath;
        const prodDistPath = fs.existsSync(path.join(bundledDir, "index.html"))
          ? bundledDir
          : path.resolve(process.cwd(), "dist");
        const prodIndexPath = path.join(prodDistPath, "index.html");

        app.use(express.static(prodDistPath, { 
          index: false,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
            } else if (filePath.includes('/assets/') || filePath.includes('\\assets\\')) {
              // Vite hashed bundles - immutable cache for 1 year
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              // Other static assets (favicons, manifests, etc.) - short revalidate
              res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
            }
          }
        }));

        app.use((req, res) => {
          if (req.path.startsWith("/api")) {
            return res.status(404).json({ error: "Endpoint not found" });
          }
          // Ensure mobile and desktop browsers never hold an obsolete HTML cache
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');

          try {
            if (fs.existsSync(prodIndexPath)) {
              const rawHtml = fs.readFileSync(prodIndexPath, "utf-8");
              const htmlWithSEO = injectSEOIntoHtml(rawHtml, req.originalUrl, req.get("host") || "theunbound.in");
              return res.status(200).set({ "Content-Type": "text/html" }).send(htmlWithSEO);
            }
            return res.sendFile(prodIndexPath);
          } catch (err) {
            return res.sendFile(prodIndexPath);
          }
        });
      }

      // In AI Studio Build runtime, NGINX is reverse proxying from 8080 to 3000.
      // Express must strictly listen on port 3000.
      const port = 3000;
      let primaryServer: any = null;

      try {
        const s = app.listen(port, "0.0.0.0", () => {
          console.log(`[SERVER] Ready and listening on port ${port}`);
          primaryServer = s;
          startCashbackScheduler();
          resolve(primaryServer);
        });

        s.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[SERVER] Port ${port} is in use (reusing active listener).`);
            resolve(primaryServer || s);
          } else {
            console.error(`[SERVER] Fatal listener error on port ${port}:`, err);
            serverPromise = null;
            reject(err);
          }
        });
      } catch (e) {
        console.warn(`[SERVER] Failed to initiate listener on port ${port}:`, e);
        serverPromise = null;
        reject(e);
      }
    } catch (err) {
      serverPromise = null;
      reject(err);
    }
  });

  return serverPromise;
}

// Auto-start if executed directly as entrypoint
const isDirectEntrypoint = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith("server.cjs") ||
   process.argv[1].endsWith("main.ts"))
);

if (isDirectEntrypoint) {
  startServer().catch((err) => {
    console.error("[SERVER] Startup failed:", err);
    process.exit(1);
  });
}
