// Runs the build script for a specific package from the repo root.
// Usage: yarn build <package>
// Example: yarn build client

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = process.argv[2];

const BUILDABLE = ["client", "bookmarklet"];

if (!pkg) {
  console.error(`Usage: yarn build <package>`);
  console.error(`Available: ${BUILDABLE.join(", ")}`);
  process.exit(1);
}

if (!BUILDABLE.includes(pkg)) {
  console.error(`Unknown package: "${pkg}"`);
  console.error(`Available: ${BUILDABLE.join(", ")}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["scripts/build.mjs"],
  { cwd: resolve(root, pkg), stdio: "inherit" },
);

process.exit(result.status ?? 1);
