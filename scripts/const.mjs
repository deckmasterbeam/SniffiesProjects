import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_RELEASE_ENV_VARS = ["SERVER_BASE", "CLIENT_SECRET"];

export const BUILDABLE_PACKAGE_LIST = ["client", "bookmarklet", "userscript"];

export const PACKAGE_LIST = ["core", "server", "watcher", "e2e", ...BUILDABLE_PACKAGE_LIST];

export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const makeTextBlock = (text) => "\n" + "─".repeat(40) + `\n  ${text}\n` + "─".repeat(40) + "\n";
