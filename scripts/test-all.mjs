// Runs vitest in each package that has a test script sequentially. Exits with code 1 if any package fails.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { PACKAGE_LIST, ROOT_DIR, makeTextBlock } from "./const.mjs";

let failed = false;

for (const pkg of PACKAGE_LIST) {
  console.log(makeTextBlock(`Testing: ${pkg}`));

  const result = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run"],
    { cwd: resolve(ROOT_DIR, pkg), stdio: "inherit" },
  );

  if (result.status !== 0) {
    failed = true;
  }
}

console.log(makeTextBlock(failed ? "Some packages failed tests" : "All packages passed tests"));
if (failed) {
  process.exit(1);
}
