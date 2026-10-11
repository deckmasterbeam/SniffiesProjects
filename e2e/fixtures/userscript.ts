import type { Page } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SNIFFIES_ORIGIN } from "./constants.js";
import { mockSniffiesPage, seedLocalStorage } from "./core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERSCRIPT_CODE = readFileSync(
  path.resolve(__dirname, "../../userscript/dist/sniffies-tools.user.js"),
  "utf-8",
);

export { SNIFFIES_ORIGIN, mockSniffiesPage, seedLocalStorage as seedUserscriptStorage };

export const injectUserscript = (page: Page) => page.addInitScript({ content: USERSCRIPT_CODE });
