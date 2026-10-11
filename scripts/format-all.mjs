// Runs each package's own `format` script, sequentially. Pass `--check` to run `format:check`.
// Exits with code 1 if any package fails.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const packages = ["core", "client", "bookmarklet", "userscript", "server", "watcher", "e2e"];
const script = process.argv.includes("--check") ? "format:check" : "format";

let failed = false;

for (const pkg of packages) {
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  ${script}: ${pkg}`);
  console.log(`${"─".repeat(40)}\n`);

  const result = spawnSync("yarn", [script], {
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
  console.log(`  ✗ ${script} failed in some packages`);
  process.exit(1);
} else {
  console.log(`  ✓ ${script} passed in all packages`);
}
