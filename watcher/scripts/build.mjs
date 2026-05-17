// Build script: bundles TS entry points with esbuild and copies static assets into dist/.

import { context, build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");

const tsEntries = [
  "src/background/background.ts",
  "src/content/sniffies-ws-hook.ts",
  "src/content/sniffies-events.ts",
  "src/content/sniffies-captcha-hook.ts",
  "src/content/sniffies-auth-hook.ts",
  "src/popup/popup.ts",
];

const staticAssets = ["manifest.json", "src/popup/popup.html"];

const copyAssets = async () => {
  for (const rel of staticAssets) {
    const from = join(root, rel);
    if (!existsSync(from)) {
      continue;
    }
    const to = join(distDir, rel);
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to);
  }

  const iconsDir = join(root, "icons");
  if (existsSync(iconsDir)) {
    await cp(iconsDir, join(distDir, "icons"), { recursive: true });
  }
};

const buildOptions = {
  entryPoints: tsEntries.map((entry) => ({
    in: join(root, entry),
    out: entry.replace(/\.ts$/, ""),
  })),
  outdir: distDir,
  bundle: true,
  format: "esm",
  target: "chrome120",
  platform: "browser",
  sourcemap: true,
  logLevel: "info",
  define: {
    __SERVER_BASE__: JSON.stringify(process.env.SERVER_BASE ?? ""),
    __WATCHER_SECRET__: JSON.stringify(process.env.WATCHER_SECRET ?? ""),
  },
};

const run = async () => {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await copyAssets();

  if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("[build] watching for changes...");
  } else {
    await build(buildOptions);
    console.log("[build] dist/ ready");
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
