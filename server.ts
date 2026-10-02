import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const distBundlePath = path.resolve(process.cwd(), "dist", "server.cjs");
const isRunningWithTsx = process.execArgv.some((a) => a.includes("tsx")) || 
                         process.argv.some((a) => a.includes("tsx"));

async function bootstrap() {
  if (fs.existsSync(distBundlePath) && !isRunningWithTsx) {
    // Production Cloud Run container execution using compiled bundle
    const bundle = require(distBundlePath);
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

