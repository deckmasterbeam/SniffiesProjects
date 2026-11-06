import { test, expect } from "@playwright/test";
import { SNIFFIES_ORIGIN, injectUserscript, mockSniffiesPage } from "../../fixtures/userscript.js";

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
