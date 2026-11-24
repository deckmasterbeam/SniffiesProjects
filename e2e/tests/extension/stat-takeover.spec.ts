import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, SNIFFIES_ORIGIN } from "../../fixtures/extension.js";
import { setExtensionStorage } from "../../fixtures/storage.js";
import {
  OWNED_FILTERS,
  expectNoneListedHidden,
  expectNoneListedKept,
  expectRequestStripped,
  expectSavedFiltersLoadedDisabled,
  mockSniffiesApi,
} from "../../fixtures/stat-takeover.js";

const MIRROR = "snp-applied-profile-filters";

/**
 * Seeds the extension's settings and loads the page twice: the first load has the extension write
 * the copy of the filters the page hook starts from, the second starts the hook from it, as every
 * load after the first does for a real user.
 */
const load = async (context: BrowserContext, filters: unknown): Promise<Page> => {
  await setExtensionStorage(context, {
    sniffiesUserId: "cccccccccccccccccccccccc",
    profileFiltersEnabled: true,
    profileFilters: filters,
  });
  const page = await context.newPage();
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, MIRROR);
  await page.reload();
  return page;
};

test("the map request leaves without the stats the extension owns", async ({ context }) => {
  const posted = await mockSniffiesApi(context);
  const page = await load(context, OWNED_FILTERS);
  await expectRequestStripped(page, posted);
});

test("Sniffies' saved filters load with those stats off", async ({ context }) => {
  await mockSniffiesApi(context);
  const page = await load(context, OWNED_FILTERS);
  await expectSavedFiltersLoadedDisabled(page);
});

test("a profile with none listed stays on the map while 'none listed' is on", async ({
  context,
}) => {
  await mockSniffiesApi(context);
  const page = await load(context, OWNED_FILTERS);
  await expectNoneListedKept(page);
});

test("and is hidden while it is off", async ({ context }) => {
  await mockSniffiesApi(context);
  const page = await load(context, { ...OWNED_FILTERS, unlisted: { endowment: false } });
  await expectNoneListedHidden(page);
});

test("nothing is stripped or rewritten while the profile filters are off", async ({ context }) => {
  const posted = await mockSniffiesApi(context);
  await setExtensionStorage(context, {
    sniffiesUserId: "cccccccccccccccccccccccc",
    profileFiltersEnabled: false,
    profileFilters: OWNED_FILTERS,
  });
  const page = await context.newPage();
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, MIRROR);
  await page.reload();

  const sent = JSON.stringify({
    filters: { CRUISER_STATS: { value: { "stats.endowment": { min: 20, max: 30 } } } },
  });
  await page.evaluate(
    ([url, body]) =>
      new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url!);
        xhr.onload = () => resolve();
        xhr.send(body);
      }),
    [`${SNIFFIES_ORIGIN}/api/post-authentication`, sent],
  );
  expect(posted["/api/post-authentication"]!.at(-1)).toBe(sent);
});
