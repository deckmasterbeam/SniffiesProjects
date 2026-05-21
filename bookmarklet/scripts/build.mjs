import { context, build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");

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
  },
  define: {
    __DEBUG__: String(process.env.DEBUG === "true"),
  },
};

const run = async () => {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("[build] watching for changes...");
  } else {
    await build(buildOptions);
    console.log("[build] dist/inject.js ready");
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
