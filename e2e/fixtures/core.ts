import type { BrowserContext, Page } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SNIFFIES_ORIGIN } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = readFileSync(path.resolve(__dirname, "sniffies-mock.html"), "utf-8");

/** Routes any sniffies.com navigation to the shared fixture page */
export const mockSniffiesPage = (context: BrowserContext) =>
  context.route(`${SNIFFIES_ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: "text/html", body: FIXTURE_HTML }),
  );

export const seedLocalStorage = (page: Page, data: Record<string, string>) =>
  page.addInitScript((seed) => {
    for (const [key, value] of Object.entries(seed)) {
      localStorage.setItem(key, value);
    }
  }, data);
