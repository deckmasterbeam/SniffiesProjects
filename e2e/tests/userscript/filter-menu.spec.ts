import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { routeLiveSocket } from "../../fixtures/bot-block.js";
import {
  OPTIONS_PATH,
  addFilterMenu,
  applyAndReload,
  neighbour,
  seedLocalStorageOnce,
  wheelItems,
} from "../../fixtures/filter-menu.js";
import { joinedFrames, mapIds, responses } from "../../fixtures/profile-filters.js";
import { mockApi, sendXhr } from "../../fixtures/sniffies-api.js";
import { SNIFFIES_ORIGIN, injectUserscript, mockSniffiesPage } from "../../fixtures/userscript.js";

const FILTERS_KEY = "sniffies-profile-filters";
const ENABLED_KEY = "sniffies-profile-filters-enabled";

const load = async (
  page: Page,
  context: BrowserContext,
  options: { cruisingNow?: boolean; extra?: Record<string, unknown> } = {},
): Promise<Record<string, string[]>> => {
  await mockSniffiesPage(context);
  const posted = await mockApi(context, { ...responses(), ...options.extra });
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  await routeLiveSocket(page, joinedFrames());
  await seedLocalStorageOnce(page, { [FILTERS_KEY]: "{}", [ENABLED_KEY]: "true" });
  await addFilterMenu(page, { cruisingNow: options.cruisingNow });
  await injectUserscript(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await expect(page.locator("#snp-gender-filter")).toBeVisible();
  return posted;
};

test("every row mounts in its place and is visible, with Sniffies' own Endowment line hidden", async ({
  page,
  context,
}) => {
  await load(page, context);

  for (const id of ["gender", "online", "age", "position", "bodyType", "endowment", "sexuality"]) {
    await expect(page.locator(`#snp-${id}-filter`), id).toBeVisible();
  }
  await expect(page.locator("#snp-height-filter")).toBeVisible();
  await expect(page.locator("#snp-weight-filter")).toBeVisible();

  expect(await neighbour(page, "snp-online-filter", "previousElementSibling")).toBe(
    "UI-LIST-ITEM-LEVEL-2",
  );
  expect(await neighbour(page, "snp-gender-filter", "previousElementSibling")).toBe(
    "FILTER-TYPE-COMPONENT",
  );
  expect(await neighbour(page, "snp-endowment-filter", "nextElementSibling")).toBe(
    "snp-height-filter",
  );
  expect(await neighbour(page, "snp-height-filter", "nextElementSibling")).toBe(
    "snp-weight-filter",
  );
  await expect(page.locator('label[for="stats.endowment"]')).toBeHidden();
  await expect(page.locator("#CONNECTED_NOW")).toHaveCount(1);
});

test("Gender set in the menu filters the map after Reload to apply", async ({ page, context }) => {
  await load(page, context);
  expect(await mapIds(page)).toHaveLength(5);

  await page.locator("#snp-gender-filter-enabled").check({ force: true });
  for (const gender of ["woman", "nonbinary", "undefined"]) {
    await page.locator(`#snp-gender-filter [data-gender="${gender}"]`).click();
  }
  await applyAndReload(page, "snp-gender-filter");

  expect(await mapIds(page)).toEqual(["man180", "tall200", "stale"]);
});

test("Height picked on its wheels filters the map after Reload to apply", async ({
  page,
  context,
}) => {
  await load(page, context);

  await page.locator("#snp-height-filter .stat-button").click();
  await wheelItems(page, "min").filter({ hasText: `5'7"` }).click();
  await wheelItems(page, "max").filter({ hasText: `6'2"` }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#snp-height-filter .text-value")).toHaveText(/5'7" - 6'2"/);
  await applyAndReload(page, "snp-height-filter");

  expect(await mapIds(page)).toEqual(["man180", "stale"]);
  await expect(page.locator("#snp-height-filter .text-value")).toHaveText(/5'7" - 6'2"/);
});

test("Online After turns Cruising Now off, and saves that to Sniffies", async ({
  page,
  context,
}) => {
  const posted = await load(page, context, { cruisingNow: true });
  await expect(page.locator("#CONNECTED_NOW")).toBeChecked();

  await page.locator("#snp-online-filter label").first().click();
  await wheelItems(page, "choice").filter({ hasText: "< 3 hours ago" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.locator("#CONNECTED_NOW")).not.toBeChecked();
  await expect
    .poll(() => posted[OPTIONS_PATH])
    .toEqual([JSON.stringify({ filters: { CONNECTED_NOW: false } })]);
});

test("a metric account's wheels are in cm, with no unit wheel", async ({ page, context }) => {
  const account = { user: { private: { options: { units: "metric" } } } };
  await load(page, context, { extra: { "/api/authenticate/current": account } });
  await sendXhr(page, "POST", `${SNIFFIES_ORIGIN}/api/authenticate/current`, {});

  await page.locator("#snp-height-filter .stat-button").click();
  await expect(wheelItems(page, "min").nth(1)).toHaveText("120cm");
  await expect(page.locator('.snp-wheel[data-wheel="unit"]')).toHaveCount(0);
});
