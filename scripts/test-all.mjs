// Runs vitest in each package that has a test script, sequentially.
// Exits with code 1 if any package fails.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const packages = ["core", "client", "bookmarklet", "server"];

let failed = false;

for (const pkg of packages) {
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  Testing: ${pkg}`);
  console.log(`${"─".repeat(40)}\n`);

  const result = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run"],
    { cwd: resolve(root, pkg), stdio: "inherit" },
  );

  if (result.status !== 0) {
    failed = true;
  }
}

console.log(`\n${"─".repeat(40)}`);
if (failed) {
  console.log("  ✗ Some packages failed");
  process.exit(1);
} else {
  console.log("  ✓ All packages passed");
}
