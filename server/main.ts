import express from "express";
import path from "path";
import fs from "fs";
import { handleSitemapXml, handleRobotsTxt, injectSEOIntoHtml } from "./seoHandler";
import { handleGeminiChat } from "./geminiChatHandler";
import { createIntegrationsRouter } from "./integrationsService";
import { createFXRouter } from "./fxService";
import { createAdminUserRouter } from "./adminUserService";

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

      app.use(express.json({ limit: '10mb' }));

      // API routes FIRST
      app.get("/api/health", (req, res) => {
        res.json({ status: "ok", service: "theunbound-dmc-portal" });
      });

      // Secure Server-Side Integrations Router (Gmail, Google Sheets, Token Refresh)
      app.use("/api/integrations", createIntegrationsRouter());

      // Secure Server-Side Admin User Management Router (Deletion, Deactivation)
      app.use("/api/admin/users", createAdminUserRouter());

      // Centralized Live XE.com FX Currency Engine Router
      app.use("/api/fx", createFXRouter());

      // TheUnbound Gemini AI Chatbot endpoint
      app.post("/api/gemini/chat", handleGeminiChat);

      // SEO Technical Endpoints
      app.get("/sitemap.xml", handleSitemapXml);
      app.get("/robots.txt", handleRobotsTxt);

      // Robust environment detection: in production bundles or when dist build exists, never load Vite dev server
      const distPath = path.resolve(process.cwd(), "dist");
      const indexPath = path.join(distPath, "index.html");
      const hasDistBuild = fs.existsSync(indexPath);
      const isDev = process.env.NODE_ENV === "development" || process.env.npm_lifecycle_event === "dev";
      const isProduction = process.env.NODE_ENV === "production" || (!isDev && hasDistBuild);

      if (!isProduction) {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "custom",
        });

        // Handle HTML requests with SEO meta injection in development
        app.use(async (req, res, next) => {
          const url = req.originalUrl;
          // Skip API, static assets, internal vite routes
          if (
            url.startsWith("/api") ||
            url.startsWith("/@") ||
            url.startsWith("/src") ||
            url.startsWith("/node_modules") ||
            (url.includes(".") && !url.endsWith(".html"))
          ) {
            return next();
          }

          try {
            const templatePath = path.resolve(process.cwd(), "index.html");
            let template = fs.readFileSync(templatePath, "utf-8");
            template = await vite.transformIndexHtml(url, template);
            const htmlWithSEO = injectSEOIntoHtml(template, url, req.get("host") || "theunbound.luxury");
            res.status(200).set({ "Content-Type": "text/html" }).end(htmlWithSEO);
          } catch (e: any) {
            vite.ssrFixStacktrace(e);
            next(e);
          }
        });

        app.use(vite.middlewares);
      } else {
        const distPath = path.resolve(process.cwd(), "dist");
        const indexPath = path.join(distPath, "index.html");

        app.use(express.static(distPath, { 
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

        app.get("*all", (req, res) => {
          if (req.path.startsWith("/api")) {
            return res.status(404).json({ error: "Endpoint not found" });
          }
          // Ensure mobile and desktop browsers never hold an obsolete HTML cache
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');

          try {
            if (fs.existsSync(indexPath)) {
              const rawHtml = fs.readFileSync(indexPath, "utf-8");
              const htmlWithSEO = injectSEOIntoHtml(rawHtml, req.originalUrl, req.get("host") || "theunbound.luxury");
              return res.status(200).set({ "Content-Type": "text/html" }).send(htmlWithSEO);
            }
            return res.sendFile(indexPath);
          } catch (err) {
            return res.sendFile(indexPath);
          }
        });
      }

      // In AI Studio / Cloud Run container architecture:
      // Nginx reverse proxy listens on external Cloud Run PORT (8080)
      // and forwards all web and API traffic to Node on port 3000 (proxy_pass http://localhost:3000).
      // Node MUST listen on port 3000 (never 8080, which is bound by Nginx).
      const PORT = (process.env.PORT && process.env.PORT !== "8080") ? parseInt(process.env.PORT, 10) : 3000;

      const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
        resolve(server);
      });

      server.on('error', (err: any) => {
        console.error(`[SERVER] Failed to listen on port ${PORT}:`, err);
        serverPromise = null;
        reject(err);
        process.exit(1);
      });
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
