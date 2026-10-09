import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const distBundlePath = path.resolve(process.cwd(), "dist", "server.cjs");
const buildBundlePath = path.resolve(process.cwd(), "build", "server.cjs");
const isRunningWithTsx = process.execArgv.some((a) => a.includes("tsx")) || 
                         process.argv.some((a) => a.includes("tsx"));

async function bootstrap() {
  const bundlePath = fs.existsSync(distBundlePath) ? distBundlePath : fs.existsSync(buildBundlePath) ? buildBundlePath : null;
  if (bundlePath && !isRunningWithTsx) {
    // Production Cloud Run container execution using compiled bundle
    process.env.NODE_ENV = "production";
    const bundle = require(bundlePath);
    if (typeof bundle.startServer === "function") {
      await bundle.startServer();
    }
  } else {
    // Development runtime via Vite middleware
    const { startServer } = await import("./server/main.ts");
    await startServer();
  }
}

bootstrap().catch((err) => {
  console.error("[SERVER] Startup failed:", err);
  process.exit(1);
});

