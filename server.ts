import express from "express";
import path from "path";
import fs from "fs";
import { handleSitemapXml, handleRobotsTxt, injectSEOIntoHtml } from "./server/seoHandler";
import { handleGeminiChat } from "./server/geminiChatHandler";
import { createIntegrationsRouter } from "./server/integrationsService";

// Prevent unexpected unhandled crashes
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught Exception:', error);
});

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "theunbound-dmc-portal" });
  });

  // Secure Server-Side Integrations Router (Gmail, Google Sheets, Token Refresh)
  app.use("/api/integrations", createIntegrationsRouter());

  // TheUnbound Gemini AI Chatbot endpoint
  app.post("/api/gemini/chat", handleGeminiChat);

  // SEO Technical Endpoints
  app.get("/sitemap.xml", handleSitemapXml);
  app.get("/robots.txt", handleRobotsTxt);

  // Robust environment detection: in production bundles, never load Vite dev server
  const isCompiledBundle =
    Boolean(process.argv[1] && (process.argv[1].includes("dist") || process.argv[1].endsWith(".cjs"))) ||
    (typeof __filename !== "undefined" && __filename.endsWith(".cjs"));
  const isProduction = process.env.NODE_ENV === "production" || isCompiledBundle;

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

    app.use(express.static(distPath, { index: false }));
    app.get("*all", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "Endpoint not found" });
      }
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

  const DEFAULT_PORT = 3000;
  const cloudRunPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

  // Primary bind: Port 3000 (required by internal proxy)
  const server3000 = app.listen(DEFAULT_PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${DEFAULT_PORT}`);
  });
  server3000.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[SERVER] Port ${DEFAULT_PORT} already in use`);
    } else {
      console.error(`[SERVER] Port ${DEFAULT_PORT} error:`, err);
    }
  });

  // Cloud Run direct traffic & health checks (bind to process.env.PORT, typically 8080)
  if (cloudRunPort && cloudRunPort !== DEFAULT_PORT && !isNaN(cloudRunPort)) {
    try {
      const serverCloudRun = app.listen(cloudRunPort, "0.0.0.0", () => {
        console.log(`Server also listening on Cloud Run port ${cloudRunPort}`);
      });
      serverCloudRun.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          // Expected in sandbox dev container where reverse proxy binds PORT 8080
          console.log(`[SERVER] Cloud Run port ${cloudRunPort} is handled by reverse proxy`);
        } else {
          console.warn(`[SERVER] Cloud Run port ${cloudRunPort} error:`, err);
        }
      });
    } catch (err) {
      console.warn(`[SERVER] Could not bind to Cloud Run port ${cloudRunPort}:`, err);
    }
  }
}

startServer();
