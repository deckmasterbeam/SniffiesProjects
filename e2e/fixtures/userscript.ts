import type { BrowserContext, Page } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SNIFFIES_ORIGIN } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERSCRIPT_CODE = readFileSync(
  path.resolve(__dirname, "../../userscript/dist/sniffies-tools.user.js"),
  "utf-8",
);
const FIXTURE_HTML = readFileSync(path.resolve(__dirname, "sniffies-mock.html"), "utf-8");

export { SNIFFIES_ORIGIN };

/**
 * "Direct injection" loading strategy (PLAYWRIGHT_TESTING_TODO.md §0): runs
 * the exact built dist file — the same one a real userscript manager would
 * run at @run-at document-start (userscript/scripts/build.mjs's metadata
 * block) — via Playwright's addInitScript, without an actual manager
 * runtime in between. Safe because the userscript declares `@grant none` and
 * only ever touches plain `localStorage`/DOM/fetch/geolocation — no GM_*
 * APIs a manager would need to polyfill.
 *
 * A Tampermonkey-based smoke test (a real manager, more realistic, more
 * setup) is tracked as a follow-up in PLAYWRIGHT_TESTING_TODO.md §0, not
 * built here.
 *
 * Call this AFTER any seedUserscriptStorage() and BEFORE page.goto() —
 * Playwright runs addInitScript registrations, in the order they were
 * added, before the next navigation's own scripts.
 */
export const injectUserscript = (page: Page) => page.addInitScript({ content: USERSCRIPT_CODE });

/** Routes any sniffies.com navigation to the shared fixture page — the same one the Chrome extension tests use. */
export const mockSniffiesPage = (context: BrowserContext) =>
  context.route(`${SNIFFIES_ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: "text/html", body: FIXTURE_HTML }),
  );

/**
 * Seeds the userscript's localStorage-backed settings before it loads — see
 * the *_STORAGE_KEY constants in userscript/src/shared/settings.ts for key
 * names and JSON shapes. Unlike the Chrome extension's chrome.storage.local
 * (async), localStorage reads are synchronous, and userscript.ts reads them
 * at module-init time — so as long as this runs before injectUserscript(),
 * there's no init race to wait out.
 */
export const seedUserscriptStorage = (page: Page, data: Record<string, string>) =>
  page.addInitScript((seed) => {
    for (const [key, value] of Object.entries(seed)) {
      localStorage.setItem(key, value);
    }
  }, data);
