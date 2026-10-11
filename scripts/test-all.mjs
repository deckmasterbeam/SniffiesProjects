// Runs each package's own `test` script, sequentially.
// Exits with code 1 if any package fails.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const packages = ["core", "client", "bookmarklet", "userscript", "server"];

let failed = false;

for (const pkg of packages) {
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  Testing: ${pkg}`);
  console.log(`${"─".repeat(40)}\n`);

  const result = spawnSync("yarn", ["test"], {
    cwd: resolve(root, pkg),
    stdio: "inherit",
    shell: true,
  });

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
