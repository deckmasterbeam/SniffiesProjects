import { test, expect, type Page } from "@playwright/test";
import {
  SNIFFIES_ORIGIN,
  mockSniffiesPage,
  seedBookmarkletStorage,
  tapBookmarklet,
} from "../../fixtures/bookmarklet.js";

const STORAGE_KEY = "sniffies-profile-border";
const OUTSIDE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const OUTSIDE_MARKER = '[data-testid="markerUserContainer"][data-within-radius="false"]';
const INSIDE_MARKER = '[data-testid="markerUserContainer"][data-within-radius="true"]';
const NAME_LABEL = '[data-testid="cruiserNameLabel"]';
const PROFILE_URL = `${SNIFFIES_ORIGIN}/profile/${OUTSIDE_ID}`;

const seed = (page: Page, enabled: boolean, openInNewTab: boolean) =>
  seedBookmarkletStorage(page, { [STORAGE_KEY]: JSON.stringify({ enabled, openInNewTab }) });

const addCompetingListener = async (page: Page): Promise<() => Promise<number>> => {
  await page.locator(OUTSIDE_MARKER).evaluate((marker) => {
    const w = window as unknown as { competingClicks: number };
    w.competingClicks = 0;
    marker.addEventListener("click", () => {
      w.competingClicks += 1;
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { competingClicks: number }).competingClicks);
};

test.beforeEach(async ({ context }) => {
  await mockSniffiesPage(context);
});

test("outside-radius marker opens the profile in a new tab and suppresses the site's handler", async ({
  page,
  context,
}) => {
  await seed(page, true, true);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  const competingClicks = await addCompetingListener(page);
  await tapBookmarklet(page);

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.locator(OUTSIDE_MARKER).click(),
  ]);

  await popup.waitForURL(PROFILE_URL);
  expect(page.url()).toBe(`${SNIFFIES_ORIGIN}/`);
  expect(await competingClicks()).toBe(0);
});

test("outside-radius marker navigates the current tab when openInNewTab is false", async ({
  page,
  context,
}) => {
  await seed(page, true, false);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await tapBookmarklet(page);

  await page.locator(OUTSIDE_MARKER).click();

  await page.waitForURL(PROFILE_URL);
  expect(context.pages()).toHaveLength(1);
});

test("feature disabled: the click falls through to the site's handler", async ({
  page,
  context,
}) => {
  await seed(page, false, true);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  const competingClicks = await addCompetingListener(page);
  await tapBookmarklet(page);

  await page.locator(OUTSIDE_MARKER).click();

  expect(await competingClicks()).toBe(1);
  expect(page.url()).toBe(`${SNIFFIES_ORIGIN}/`);
  expect(context.pages()).toHaveLength(1);
});

test("within-radius marker is never intercepted", async ({ page }) => {
  await seed(page, true, false);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await tapBookmarklet(page);

  await page.locator(INSIDE_MARKER).click();

  await expect(page.locator(NAME_LABEL)).toBeVisible();
  expect(page.url()).toBe(`${SNIFFIES_ORIGIN}/`);
});

test("marker with no data-within-radius attribute is never intercepted", async ({ page }) => {
  await seed(page, true, false);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  const marker = page.locator(INSIDE_MARKER);
  await marker.evaluate((el) => el.removeAttribute("data-within-radius"));
  await tapBookmarklet(page);

  await page.locator('[data-testid="markerUserContainer"]').first().click();

  await expect(page.locator(NAME_LABEL)).toBeVisible();
  expect(page.url()).toBe(`${SNIFFIES_ORIGIN}/`);
});

test("enabling in the panel saves to localStorage and takes effect without a reload", async ({
  page,
  context,
}) => {
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await tapBookmarklet(page);

  await page.locator("#snp-fab").click();
  await page.locator("#profile-border-details > summary").click();
  await page.locator("#profile-border-enabled").check();

  // openInNewTab defaults to true (DEFAULT_PROFILE_BORDER_OPEN).
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
    JSON.stringify({ enabled: true, openInNewTab: true }),
  );

  await page.locator("#snp-close").click();
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.locator(OUTSIDE_MARKER).click(),
  ]);
  await popup.waitForURL(PROFILE_URL);
});

test("panel settings persist across a page load and re-tap", async ({ page }) => {
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await tapBookmarklet(page);
  await page.locator("#snp-fab").click();
  await page.locator("#profile-border-details > summary").click();
  await page.locator("#profile-border-enabled").check();
  await page.locator("#profile-border-tab").selectOption("current-tab");
  await page.locator("#profile-border-save").click();
  await expect(page.locator("#profile-border-save")).toBeHidden();

  await page.reload();
  await tapBookmarklet(page);
  await page.locator("#snp-fab").click();

  // The section's own open/closed state is remembered too.
  await expect(page.locator("#profile-border-enabled")).toBeChecked();
  await expect(page.locator("#profile-border-tab")).toHaveValue("current-tab");
});
