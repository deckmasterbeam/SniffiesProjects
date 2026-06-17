import { context, build } from "esbuild";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");

const METADATA = `\
// ==UserScript==
// @name         Sniffies Tools
// @namespace    https://sniffies.com
// @version      0.1.0
// @description  Location spoofing for Sniffies
// @match        https://sniffies.com/*
// @match        https://*.sniffies.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
`;

const tmpFile = join(distDir, "_userscript.tmp.js");
const outFile = join(distDir, "sniffies-tools.user.js");

const buildOptions = {
  entryPoints: [join(root, "src/userscript.ts")],
  outfile: tmpFile,
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
};

const prependMetadata = async () => {
  const code = await readFile(tmpFile, "utf8");
  await writeFile(outFile, METADATA + "\n" + code, "utf8");
  await rm(tmpFile, { force: true });
  console.log("[build] dist/sniffies-tools.user.js ready");
};

const run = async () => {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  if (watch) {
    const plugin = {
      name: "prepend-metadata",
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            await prependMetadata();
          }
        });
      },
    };
    const ctx = await context({ ...buildOptions, plugins: [plugin] });
    await ctx.watch();
    console.log("[build] watching for changes...");
  } else {
    await build(buildOptions);
    await prependMetadata();
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
