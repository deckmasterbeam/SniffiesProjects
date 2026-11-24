import { test } from "@playwright/test";
import {
  SNIFFIES_ORIGIN,
  injectUserscript,
  mockSniffiesPage,
  seedUserscriptStorage,
} from "../../fixtures/userscript.js";
import {
  OWNED_FILTERS,
  expectNoneListedHidden,
  expectNoneListedKept,
  expectRequestStripped,
  expectSavedFiltersLoadedDisabled,
  mockSniffiesApi,
} from "../../fixtures/stat-takeover.js";

const FILTERS_KEY = "sniffies-profile-filters";
const ENABLED_KEY = "sniffies-profile-filters-enabled";

const load = async (
  page: import("@playwright/test").Page,
  filters: unknown,
  enabled = "true",
): Promise<void> => {
  await seedUserscriptStorage(page, {
    [FILTERS_KEY]: JSON.stringify(filters),
    [ENABLED_KEY]: enabled,
  });
  await injectUserscript(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
};

test.beforeEach(async ({ context }) => {
  await mockSniffiesPage(context);
});

test("the map request leaves without the stats the userscript owns", async ({ page, context }) => {
  const posted = await mockSniffiesApi(context);
  await load(page, OWNED_FILTERS);
  await expectRequestStripped(page, posted);
});

test("Sniffies' saved filters load with those stats off", async ({ page, context }) => {
  await mockSniffiesApi(context);
  await load(page, OWNED_FILTERS);
  await expectSavedFiltersLoadedDisabled(page);
});

test("a profile with none listed stays on the map while 'none listed' is on", async ({
  page,
  context,
}) => {
  await mockSniffiesApi(context);
  await load(page, OWNED_FILTERS);
  await expectNoneListedKept(page);
});

test("and is hidden while it is off", async ({ page, context }) => {
  await mockSniffiesApi(context);
  await load(page, { ...OWNED_FILTERS, unlisted: { endowment: false } });
  await expectNoneListedHidden(page);
});
