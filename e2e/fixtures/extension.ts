import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mockServerApis } from "./server-mocks.js";
import { SNIFFIES_ORIGIN } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, "../../client/dist");
const FIXTURE_HTML = readFileSync(path.resolve(__dirname, "sniffies-mock.html"), "utf-8");

export { SNIFFIES_ORIGIN };

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    // Chrome extensions (MV3 in particular) only load in a persistent
    // context, and only reliably in a headed browser — this is Playwright's
    // own documented recipe for extension testing, not a workaround.
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });

    // Serve the local fixture for any sniffies.com navigation, so the
    // extension's content scripts — matched by the browser against the real
    // *://sniffies.com/* pattern in manifest.json — inject for real, without
    // any request ever leaving the machine (route.fulfill short-circuits it
    // at the network layer before Chromium would otherwise dial out).
    await context.route(`${SNIFFIES_ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: "text/html", body: FIXTURE_HTML }),
    );
    await mockServerApis(context);

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent("serviceworker");
    }
    // chrome-extension://<extensionId>/... — the id is the URL's host segment.
    const extensionId = worker.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
