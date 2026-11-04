import { test, expect } from "@playwright/test";
import {
  SNIFFIES_ORIGIN,
  injectUserscript,
  mockSniffiesPage,
  seedUserscriptStorage,
} from "../../fixtures/userscript.js";

const ICON_HOLDER = '[data-testid="iconHolderRightBottom"]';
const AUTH_CURRENT = "https://uswapi.sniffies.com/api/authenticate/current";
const PREMIUM_KEY = "sniffies-premium-features-enabled";
const FLAGS_KEY = "sniffies-premium-feature-flags";
const HAS_PLUS_KEY = "sniffies-has-plus";

const storage = (page: import("@playwright/test").Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(k), key);

const openPremium = async (page: import("@playwright/test").Page) => {
  await page.locator("#snp-fab").click();
  await page.locator("#premium-details > summary").click();
};

test.beforeEach(async ({ context }) => {
  await mockSniffiesPage(context);
});

test("FAB docks in the icon row and opens and closes the panel", async ({ page }) => {
  await injectUserscript(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  const fab = page.locator("#snp-fab");
  const panel = page.locator("#snp-panel");
  await expect(page.locator(`${ICON_HOLDER} > #snp-fab`)).toBeVisible();
  await expect(panel).toBeHidden();

  await fab.click();
  await expect(panel).toBeVisible();
  await fab.click();
  await expect(panel).toBeHidden();

  await fab.click();
  await panel.locator("#snp-close").click();
  await expect(panel).toBeHidden();
});

test("master switch and per-feature switches persist across a reload", async ({ page }) => {
  await injectUserscript(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await openPremium(page);
  await page.locator("#premium-enabled").uncheck();
  expect(await storage(page, PREMIUM_KEY)).toBe("false");
  await page.locator("#premium-enabled").check();
  // Flags default to on, so turn two off.
  await page.locator("#premium-flag-location").uncheck();
  await page.locator("#premium-flag-photos").uncheck();
  expect(JSON.parse((await storage(page, FLAGS_KEY))!)).toMatchObject({
    location: false,
    boundary: true,
    photos: false,
  });

  await page.reload();
  await page.locator("#snp-fab").click();
  // The section's own open/closed state is remembered too.
  await expect(page.locator("#premium-enabled")).toBeChecked();
  await expect(page.locator("#premium-flag-location")).not.toBeChecked();
  await expect(page.locator("#premium-flag-boundary")).toBeChecked();
  await expect(page.locator("#premium-flag-photos")).not.toBeChecked();
});

test("master off greys out the per-feature switches", async ({ page }) => {
  await seedUserscriptStorage(page, { [PREMIUM_KEY]: "false" });
  await injectUserscript(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await openPremium(page);

  for (const id of ["location", "boundary", "photos"]) {
    await expect(page.locator(`#premium-flag-${id}`)).toBeDisabled();
  }
  await page.locator("#premium-enabled").check();
  for (const id of ["location", "boundary", "photos"]) {
    await expect(page.locator(`#premium-flag-${id}`)).toBeEnabled();
  }
});

for (const [name, user, plus] of [
  [
    "active Plus membership",
    { private: { appstoreMembership: { name: "Plus", subscriptionStatus: "active" } } },
    true,
  ],
  // A free account has no appstoreMembership key at all.
  ["free account", { private: { profile: {} } }, false],
] as const) {
  test(`Plus notice for ${name}`, async ({ page, context }) => {
    await context.route(AUTH_CURRENT, (route) =>
      route.fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ user }),
      }),
    );
    await injectUserscript(page);
    await page.goto(`${SNIFFIES_ORIGIN}/`);
    await page.evaluate((url) => fetch(url, { method: "POST" }), AUTH_CURRENT);
    await expect.poll(() => storage(page, HAS_PLUS_KEY)).toBe(String(plus));

    // The notice is read when the panel is built, so it shows from the next load.
    await page.reload();
    await openPremium(page);
    const notice = page.locator("#premium-plus-notice");
    if (plus) {
      await expect(notice).toBeVisible();
    } else {
      await expect(notice).toBeHidden();
    }
  });
}
