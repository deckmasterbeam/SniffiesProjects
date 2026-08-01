import { context, build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const watch = process.argv.includes("--watch");

// Load .env for local dev convenience. Deployed builds (e.g. Vercel) have no
// .env file — env vars are injected into process.env directly there — so a
// missing file here is expected, not an error.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(join(root, ".env"));
  } catch {
    // no .env file present — rely on process.env as already set
  }
}

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

// Local dev convenience: copy the built script straight to the clipboard so
// it can be pasted into Tampermonkey without hunting for dist/inject.js.
// Skipped on Vercel (no clipboard there) and never allowed to fail the build.
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
    console.log("[build] copied dist/inject.js to clipboard");
  } catch (err) {
    console.warn("[build] could not copy to clipboard:", err.message);
  }
};

const run = async () => {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  if (watch) {
    const plugin = {
      name: "copy-to-clipboard",
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            await copyToClipboard(await readFile(buildOptions.outfile, "utf8"));
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
    await copyToClipboard(await readFile(buildOptions.outfile, "utf8"));
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
