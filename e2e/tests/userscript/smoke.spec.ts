import { test, expect } from "@playwright/test";
import {
  SNIFFIES_ORIGIN,
  injectUserscript,
  mockSniffiesPage,
} from "../../fixtures/userscript.js";

// First real test proving the "direct injection" loading strategy
// (PLAYWRIGHT_TESTING_TODO.md §0) actually works: the built userscript dist
// file, run via addInitScript against the shared fixture page — same
// fixture the Chrome extension tests use, since both packages target the
// same real-site DOM shapes.

test("userscript direct-injects and mounts the FAB panel", async ({ page, context }) => {
  await mockSniffiesPage(context);
  await injectUserscript(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);

  const fab = page.locator("#snp-fab");
  await expect(fab).toBeVisible();
  await fab.click();

  const panel = page.locator("#snp-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator("#snp-premium-root")).toBeVisible();
});
