// Runs `yarn install` in every package sequentially. Exits with code 1 if any package fails.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { PACKAGE_LIST, ROOT_DIR, makeTextBlock } from "./const.mjs";

let failed = false;

for (const pkg of PACKAGE_LIST) {
  console.log(makeTextBlock(`Installing: ${pkg}`));

  const result = spawnSync("yarn", ["install"], {
    cwd: resolve(ROOT_DIR, pkg),
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    failed = true;
  }
}

console.log(makeTextBlock(failed ? "✗ Some packages failed to install" : "✓ All packages installed"));
if (failed) {
  process.exit(1);
}
