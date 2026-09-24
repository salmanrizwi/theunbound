import fs from "fs";
import path from "path";

const isTsx = process.execArgv.some((arg) => arg.includes("tsx")) || process.env.npm_lifecycle_event === "dev";
const distBundlePath = path.resolve(process.cwd(), "dist", "server.cjs");

async function bootstrap() {
  if (!isTsx && fs.existsSync(distBundlePath)) {
    // Plain Node runtime (production deployment via "node server.ts"):
    // Execute high-performance compiled bundle
    await import(`file://${distBundlePath}`);
  } else {
    // Development runtime (via tsx dev server):
    const { startServer } = await import("./server/main");
    await startServer();
  }
}

bootstrap().catch((err) => {
  console.error("[SERVER] Startup failed:", err);
  process.exit(1);
});
