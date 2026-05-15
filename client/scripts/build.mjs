// Build script: bundles TS entry points with esbuild and copies static assets
// (manifest, HTML, CSS, icons) into dist/ preserving the src layout.

import { context, build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");

const tsEntries = [
  "src/background/background.ts",
  "src/content/content.ts",
  "src/content/sniffies-geo-hook.ts",
  "src/content/sniffies-geo-relay.ts",
  "src/content/sniffies-profile-id.ts",
  "src/popup/popup.ts",
  "src/options/options.ts",
  "src/favorites/favorites.ts",
];

const staticAssets = [
  "manifest.json",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/options/options.html",
  "src/options/options.css",
  "src/content/content.css",
  "src/favorites/favorites.html",
  "src/favorites/favorites.css",
];

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
    // Preserve the src/ layout so manifest.json paths resolve unchanged.
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
    __NOTIFY_ENDPOINT__: JSON.stringify(process.env.NOTIFY_ENDPOINT ?? ""),
    __NOTIFY_SECRET__: JSON.stringify(process.env.NOTIFY_SECRET ?? ""),
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
