// Build script: bundles TS entry points with esbuild and copies static assets
// (manifest, HTML, CSS, icons) into dist/ preserving the src layout.
// Pass --prod for a release build: validates SERVER_BASE/CLIENT_SECRET are
// set, forces DEBUG/FAVORITES_NOTIFICATIONS_ENABLED off, and patches
// manifest.json's version to match package.json.

import { context, build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_RELEASE_ENV_VARS } from "../../scripts/release-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");
const prod = process.argv.includes("--prod");

let releaseVersion = null;
if (prod) {
  const missingEnvVars = REQUIRED_RELEASE_ENV_VARS.filter((key) => !process.env[key]);
  if (missingEnvVars.length > 0) {
    console.error(`error: missing required env var(s) for a release build: ${missingEnvVars.join(", ")}`);
    process.exit(1);
  }

  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  releaseVersion = pkg.version;
  console.log(`[build:prod] version ${releaseVersion}`);
}

const tsEntries = [
  "src/background/background.ts",
  "src/content/content.ts",
  "src/content/sniffies-geo-hook.ts",
  "src/content/sniffies-geo-relay.ts",
  "src/content/sniffies-profile-id.ts",
  "src/content/sniffies-user-id-hook.ts",
  "src/content/sniffies-user-id-relay.ts",
  "src/popup/popup.ts",
  "src/options/options.ts",
  "src/settings/settings.ts",
];

const staticAssets = [
  "manifest.json",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/options/options.html",
  "src/options/options.css",
  "src/content/content.css",
  "src/settings/settings.html",
  "src/settings/settings.css",
];

const copyAssets = async () => {
  for (const rel of staticAssets) {
    const from = join(root, rel);
    if (!existsSync(from)) {
      continue;
    }
    const to = join(distDir, rel);
    await mkdir(dirname(to), { recursive: true });

    // Patch version in manifest.json for release builds.
    if (rel === "manifest.json" && releaseVersion) {
      const raw = await readFile(from, "utf8");
      const manifest = JSON.parse(raw);
      manifest.version = releaseVersion;
      await writeFile(to, JSON.stringify(manifest, null, 2) + "\n");
    } else {
      await cp(from, to);
    }
  }

  const iconsDir = join(root, "icons");
  if (existsSync(iconsDir)) {
    await cp(iconsDir, join(distDir, "icons"), { recursive: true });
  }
};

const buildOptions = {
  alias: {
    "@sniffies-projects/core": resolve(root, "../core/src/index.ts"),
  },
  loader: {
    ".css": "text",
    ".html": "text",
  },
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
    __SERVER_BASE__: JSON.stringify(process.env.SERVER_BASE ?? ""),
    __CLIENT_SECRET__: JSON.stringify(process.env.CLIENT_SECRET ?? ""),
    __DEBUG__: String(!prod && process.env.DEBUG === "true"),
    __FAVORITES_NOTIFICATIONS_ENABLED__: String(
      !prod && process.env.FAVORITES_NOTIFICATIONS_ENABLED !== "false",
    ),
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
