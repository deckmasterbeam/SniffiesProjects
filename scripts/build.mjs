// Runs the build script for a specific package from the repo root.
// Usage: yarn build <package>
// Example: yarn build client

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { BUILDABLE_PACKAGE_LIST, ROOT_DIR } from "./const.mjs";

const pkg = process.argv[2];

if (!pkg) {
  console.error(`Usage: yarn build <package>`);
  console.error(`Available: ${BUILDABLE_PACKAGE_LIST.join(", ")}`);
  process.exit(1);
}

if (!BUILDABLE_PACKAGE_LIST.includes(pkg)) {
  console.error(`Unknown package: "${pkg}"`);
  console.error(`Available: ${BUILDABLE_PACKAGE_LIST.join(", ")}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--env-file-if-exists=.env", "scripts/build.mjs"],
  { cwd: resolve(ROOT_DIR, pkg), stdio: "inherit" },
);

process.exit(result.status ?? 1);
