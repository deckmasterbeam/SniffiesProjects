import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];

if (!version) {
  console.error("error: version required");
  console.error("usage: yarn build:prod <version>  (e.g. yarn build:prod 1.2.0)");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`error: "${version}" is not a valid version — must be X.Y.Z`);
  process.exit(1);
}

console.log(`[build:prod] version ${version}`);

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildScript = resolve(__dirname, "build.mjs");

const child = spawn("node", [buildScript], {
  stdio: "inherit",
  env: {
    ...process.env,
    DEBUG: "false",
    NOTIFICATIONS_ENABLED: "false",
    EXTENSION_VERSION: version,
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
