// Wraps the built dist/ web extension into an iOS Safari Web Extension
// Xcode project using Apple's safari-web-extension-converter. Must be run
// on macOS with Xcode (and command-line tools) installed.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = join(root, "dist");
const outDir = join(root, "safari");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return fallback;
  const v = argv[i];
  return v.includes("=") ? v.split("=").slice(1).join("=") : argv[i + 1];
};

const bundleId = arg("bundle-id", "com.sniffies.plugins.ios");
const appName = arg("app-name", "Sniffies Plug-ins");
const open = argv.includes("--open");

if (process.platform !== "darwin") {
  console.error(
    "[package-safari-ios] This script must be run on macOS with Xcode installed.\n" +
      "  safari-web-extension-converter is provided by Xcode and only ships on macOS.",
  );
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.log("[package-safari-ios] dist/ missing — running yarn build first");
  const r = spawnSync("yarn", ["build"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

mkdirSync(outDir, { recursive: true });

const args = [
  "safari-web-extension-converter",
  distDir,
  "--project-location",
  outDir,
  "--app-name",
  appName,
  "--bundle-identifier",
  bundleId,
  "--ios-only",
  "--no-prompt",
  "--force",
  "--swift",
];
if (!open) args.push("--no-open");

console.log("[package-safari-ios] xcrun " + args.join(" "));
const child = spawn("xcrun", args, { stdio: "inherit" });
child.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  console.log(
    `\n[package-safari-ios] Xcode project generated under ${outDir}/.\n` +
      "  Next steps:\n" +
      "    1. open the generated .xcodeproj in Xcode\n" +
      "    2. set your Apple Developer signing team\n" +
      "    3. select an iOS device or Simulator and Run\n" +
      "    4. on the device: Settings > Safari > Extensions > enable, then\n" +
      "       allow the sniffies.com host permission.\n",
  );
});
