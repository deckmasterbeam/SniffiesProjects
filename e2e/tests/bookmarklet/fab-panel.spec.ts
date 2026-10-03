import { test, expect } from "@playwright/test";
import {
  SNIFFIES_ORIGIN,
  addIconHolder,
  removeIconHolder,
  mockSniffiesPage,
  tapBookmarklet,
} from "../../fixtures/bookmarklet.js";

const ICON_HOLDER = '[data-testid="iconHolderRightBottom"]';

test.beforeEach(async ({ page, context }) => {
  await mockSniffiesPage(context);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
});

test("FAB mounts in the map's icon row when it is present at load", async ({ page }) => {
  await tapBookmarklet(page);

  await expect(page.locator(`${ICON_HOLDER} > #snp-fab`)).toBeVisible();
  await expect(page.locator("#snp-fab")).toHaveClass(/snp-fab-docked/);
});

test("FAB falls back to body, then docks when the icon row appears later", async ({ page }) => {
  await removeIconHolder(page);
  await tapBookmarklet(page);
  await expect(page.locator("body > #snp-fab")).toBeVisible();

  await addIconHolder(page);

  await expect(page.locator(`${ICON_HOLDER} > #snp-fab`)).toBeVisible();
  await expect(page.locator("#snp-fab")).toHaveCount(1);
});

test("FAB and close button open and close the panel", async ({ page }) => {
  await tapBookmarklet(page);
  const fab = page.locator("#snp-fab");
  const panel = page.locator("#snp-panel");
  await expect(panel).toBeHidden();

  await fab.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator("#snp-profile-border-root")).toBeVisible();

  await fab.click();
  await expect(panel).toBeHidden();

  await fab.click();
  await panel.locator("#snp-close").click();
  await expect(panel).toBeHidden();
});

test("tapping the bookmarklet again toggles the panel instead of mounting twice", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });

  await tapBookmarklet(page);
  const panel = page.locator("#snp-panel");
  await expect(panel).toBeHidden();

  await tapBookmarklet(page);
  await expect(panel).toBeVisible();

  await tapBookmarklet(page);
  await expect(panel).toBeHidden();

  await expect(page.locator("#snp-fab")).toHaveCount(1);
  await expect(panel).toHaveCount(1);
  expect(dialogs).toHaveLength(1);
});
