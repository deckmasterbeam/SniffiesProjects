import { context, build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load bookmarklet/.env if present (absent on Vercel, which injects real env vars).
try {
  process.loadEnvFile(join(root, ".env"));
} catch {}
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const buildOptions = {
  entryPoints: [join(root, "src/inject.ts")],
  outfile: join(distDir, "inject.js"),
  bundle: true,
  format: "iife",
  target: "safari16",
  platform: "browser",
  sourcemap: false,
  logLevel: "info",
  alias: {
    "@sniffies-projects/core": resolve(root, "../core/src/index.ts"),
  },
  loader: {
    ".css": "text",
    ".html": "text",
    ".png": "dataurl",
  },
  define: {
    __DEBUG__: String(process.env.DEBUG === "true"),
    __VERSION__: JSON.stringify(pkg.version),
    __SERVER_BASE__: JSON.stringify(process.env.SERVER_BASE ?? ""),
    __CLIENT_SECRET__: JSON.stringify(process.env.CLIENT_SECRET ?? ""),
  },
};

// Copies a loader snippet for the dev server (`npx serve dist -p 5000 --cors`).
const copyLoaderToClipboard = () => {
  if (!process.env.VERCEL) {
    const loader = `var s=document.createElement('script');s.src='http://localhost:5000/inject.js?t='+Date.now();document.head.appendChild(s);`;
    spawnSync("clip", { input: loader });
  }
};

const run = async () => {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  if (watch) {
    const plugin = {
      name: "copy-to-clipboard",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length === 0) {
            copyLoaderToClipboard();
          }
        });
      },
    };
    const ctx = await context({ ...buildOptions, plugins: [plugin] });
    await ctx.watch();
    console.log("[build] watching for changes...");
  } else {
    await build(buildOptions);
    console.log("[build] dist/inject.js ready");
    copyLoaderToClipboard();
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
