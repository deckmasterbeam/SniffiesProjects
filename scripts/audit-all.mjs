// Runs `yarn audit` in every package one at a time. Exits with code 1 if any package reports vulnerabilities.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { PACKAGE_LIST, ROOT_DIR, makeTextBlock } from "./const.mjs";

let failed = false;

for (const pkg of PACKAGE_LIST) {
  console.log(makeTextBlock(`Auditing: ${pkg}`));

  const result = spawnSync("yarn", ["audit"], {
    cwd: resolve(ROOT_DIR, pkg),
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    failed = true;
  }
}

console.log(makeTextBlock(failed ? "Some packages have audit findings" : "No audit findings"));
if (failed) {
  process.exit(1);
}
