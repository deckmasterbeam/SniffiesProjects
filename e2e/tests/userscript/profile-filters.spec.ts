import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { deliverFrames, routeLiveSocket } from "../../fixtures/bot-block.js";
import {
  CASES,
  joinedFrames,
  mapIds,
  profiles,
  responses,
  searchIds,
} from "../../fixtures/profile-filters.js";
import { mockApi } from "../../fixtures/sniffies-api.js";
import {
  SNIFFIES_ORIGIN,
  injectUserscript,
  mockSniffiesPage,
  seedUserscriptStorage,
} from "../../fixtures/userscript.js";

const FILTERS_KEY = "sniffies-profile-filters";
const ENABLED_KEY = "sniffies-profile-filters-enabled";

const load = async (
  page: Page,
  context: BrowserContext,
  filters: unknown,
  enabled = "true",
): Promise<void> => {
  await mockSniffiesPage(context);
  await mockApi(context, responses());
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  await routeLiveSocket(page, joinedFrames());
  await seedUserscriptStorage(page, {
    [FILTERS_KEY]: JSON.stringify(filters),
    [ENABLED_KEY]: enabled,
  });
  await injectUserscript(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
};

for (const { name, filters, keeps } of CASES) {
  test(`${name}: the map init, an Apply result and live frames keep ${keeps.length} of 5`, async ({
    page,
    context,
  }) => {
    await load(page, context, filters);

    expect(await mapIds(page)).toEqual(keeps);
    expect(await searchIds(page)).toEqual(keeps);

    const { addEventListener, onmessage } = await deliverFrames(page);
    const expected = keeps.map((id) => `userJoined:${id}`);
    expect(addEventListener).toEqual(expected);
    expect(onmessage).toEqual(expected);
  });
}

test("the master switch off filters nothing, whatever is set", async ({ page, context }) => {
  const [, { filters }] = CASES;
  await load(page, context, filters, "false");

  const everyone = profiles().map((p) => p._id);
  expect(await mapIds(page)).toEqual(everyone);
  expect(await searchIds(page)).toEqual(everyone);
});

test("filters combine: a profile has to pass all of them", async ({ page, context }) => {
  await load(page, context, {
    gender: { enabled: true, genders: ["man"] },
    height: { enabled: true, min: 170, max: 190, includeUnspecified: false },
    online: { enabled: true, minutes: 60 },
  });
  // Men, 170–190 cm, seen within the hour: man180 only (stale is out on time, tall200 on height).
  expect(await mapIds(page)).toEqual(["man180"]);
});
