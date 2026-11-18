import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);

function resolveOutDir(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--outDir' && i + 1 < args.length) {
      return args[i + 1];
    }
    if (arg.startsWith('--outDir=')) {
      return arg.slice('--outDir='.length);
    }
  }
  return process.env.VITE_OUT_DIR || process.env.OUT_DIR || process.env.BUILD_DIR || 'dist';
}

const outDirArg = resolveOutDir(rawArgs);
const resolvedOutDir = path.resolve(rootDir, outDirArg);
const hasOutDirFlag = rawArgs.some((a) => a === '--outDir' || a.startsWith('--outDir='));
const viteArgs = hasOutDirFlag ? rawArgs : ['--outDir', outDirArg, ...rawArgs];

const viteBin = path.resolve(rootDir, 'node_modules/vite/bin/vite.js');
if (!fs.existsSync(viteBin)) {
  console.error(`[BUILD] Missing Vite binary at ${viteBin}. Run npm install first.`);
  process.exit(1);
}

const existingNodeOptions = process.env.NODE_OPTIONS || '';
const nodeArgs = existingNodeOptions.includes('--max-old-space-size')
  ? [viteBin, 'build', ...viteArgs]
  : ['--max-old-space-size=1536', viteBin, 'build', ...viteArgs];

const buildEnv = {
  ...process.env,
  NODE_ENV: 'production',
};

const viteResult = spawnSync(process.execPath, nodeArgs, {
  cwd: rootDir,
  env: buildEnv,
  stdio: 'inherit',
});

if (viteResult.error) {
  console.error('[BUILD] Failed to launch Vite build:', viteResult.error);
  process.exit(1);
}
if (viteResult.status !== 0) {
  console.error(`[BUILD] Vite build exited with code ${viteResult.status ?? 1}`);
  process.exit(viteResult.status ?? 1);
}

const serverEntry = path.resolve(rootDir, 'server/main.ts');
const serverOutFile = path.join(resolvedOutDir, 'server.cjs');

try {
  await esbuild.build({
    entryPoints: [serverEntry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vite'],
    minify: true,
    outfile: serverOutFile,
    logLevel: 'info',
  });
} catch (err) {
  console.error('[BUILD] Server bundle compilation failed:', err);
  process.exit(1);
}

const indexHtmlPath = path.join(resolvedOutDir, 'index.html');
if (!fs.existsSync(indexHtmlPath) || fs.statSync(indexHtmlPath).size === 0) {
  console.error(`[BUILD] Invalid build output: missing or empty ${indexHtmlPath}`);
  process.exit(1);
}
if (!fs.existsSync(serverOutFile) || fs.statSync(serverOutFile).size === 0) {
  console.error(`[BUILD] Invalid build output: missing or empty ${serverOutFile}`);
  process.exit(1);
}
