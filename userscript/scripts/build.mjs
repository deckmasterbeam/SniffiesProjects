import { context, build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_RELEASE_ENV_VARS } from "../../scripts/release-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");
const prod = process.argv.includes("--prod");

// Load .env for local dev convenience. Deployed builds have no .env file —
// env vars are injected into process.env directly there — so a missing file
// here is expected, not an error.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(join(root, ".env"));
  } catch {
    // no .env file present — rely on process.env as already set
  }
}

if (prod) {
  const missingEnvVars = REQUIRED_RELEASE_ENV_VARS.filter((key) => !process.env[key]);
  if (missingEnvVars.length > 0) {
    console.error(`error: missing required env var(s) for a release build: ${missingEnvVars.join(", ")}`);
    process.exit(1);
  }
}

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const METADATA = `\
// ==UserScript==
// @name         Sniffies Tools Userscript
// @namespace    https://sniffies.com
// @author       Beam
// @version      ${pkg.version}
// @description  Recreating and expanding features on top of Sniffies.com
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
  minify: prod,
  sourcemap: prod ? "inline" : false,
  logLevel: "info",
  alias: {
    "@sniffies-projects/core": resolve(root, "../core/src/index.ts"),
  },
  loader: {
    ".css": "text",
    ".html": "text",
  },
  define: {
    __DEBUG__: String(!prod),
    __SERVER_BASE__: JSON.stringify(process.env.SERVER_BASE ?? ""),
    __CLIENT_SECRET__: JSON.stringify(process.env.CLIENT_SECRET ?? ""),
    __VERSION__: JSON.stringify(pkg.version),
  },
};

const prependMetadata = async () => {
  const code = await readFile(tmpFile, "utf8");
  await writeFile(outFile, METADATA + "\n" + code, "utf8");
  await rm(tmpFile, { force: true });
  console.log("[build] dist/sniffies-tools.user.js ready");
};

// Local dev convenience: copy the built script straight to the clipboard so
// it can be pasted into a userscript manager (e.g. Tampermonkey) without
// hunting for dist/sniffies-tools.user.js. Skipped on Vercel (no clipboard
// there) and never allowed to fail the build.
const copyToClipboard = async (text) => {
  if (process.env.VERCEL) {
    return;
  }
  const [cmd, args] =
    process.platform === "win32"
      ? ["clip", []]
      : process.platform === "darwin"
        ? ["pbcopy", []]
        : ["xclip", ["-selection", "clipboard"]];
  try {
    await new Promise((res, reject) => {
      const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 ? res() : reject(new Error(`${cmd} exited ${code}`))));
      child.stdin.end(text);
    });
    console.log("[build] copied dist/sniffies-tools.user.js to clipboard");
  } catch (err) {
    console.warn("[build] could not copy to clipboard:", err.message);
  }
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
            await copyToClipboard(await readFile(outFile, "utf8"));
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
    await copyToClipboard(await readFile(outFile, "utf8"));
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
