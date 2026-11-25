import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, SNIFFIES_ORIGIN } from "../../fixtures/extension.js";
import { setExtensionStorage } from "../../fixtures/storage.js";
import { mockApi } from "../../fixtures/sniffies-api.js";
import { deliverFrames, routeLiveSocket } from "../../fixtures/bot-block.js";
import {
  CASES,
  joinedFrames,
  mapIds,
  profiles,
  responses,
  searchIds,
} from "../../fixtures/profile-filters.js";

/**
 * Same cases as `tests/userscript/profile-filters.spec.ts`, against the real extension: its state
 * reaches the page hook by message after load, so the first assertion polls for it.
 */

const load = async (context: BrowserContext, filters: unknown, enabled = true): Promise<Page> => {
  await mockApi(context, responses());
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  await setExtensionStorage(context, {
    sniffiesUserId: "cccccccccccccccccccccccc",
    profileFiltersEnabled: enabled,
    profileFilters: filters,
  });
  const page = await context.newPage();
  await routeLiveSocket(page, joinedFrames());
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  return page;
};

for (const { name, filters, keeps } of CASES) {
  test(`${name}: the map init, an Apply result and live frames keep ${keeps.length} of 5`, async ({
    context,
  }) => {
    const page = await load(context, filters);

    await expect.poll(() => mapIds(page)).toEqual(keeps);
    expect(await searchIds(page)).toEqual(keeps);

    const { addEventListener, onmessage } = await deliverFrames(page);
    const expected = keeps.map((id) => `userJoined:${id}`);
    expect(addEventListener).toEqual(expected);
    expect(onmessage).toEqual(expected);
  });
}

test("the master switch off filters nothing, whatever is set", async ({ context }) => {
  const [, { filters }] = CASES;
  const page = await load(context, filters, false);
  // Give the extension's state time to arrive, so "nothing filtered" isn't just "not loaded yet".
  await page.waitForTimeout(500);

  const everyone = profiles().map((p) => p._id);
  expect(await mapIds(page)).toEqual(everyone);
  expect(await searchIds(page)).toEqual(everyone);
});

test("filters combine: a profile has to pass all of them", async ({ context }) => {
  const page = await load(context, {
    gender: { enabled: true, genders: ["man"] },
    height: { enabled: true, min: 170, max: 190, includeUnspecified: false },
    online: { enabled: true, minutes: 60 },
  });
  // Men, 170–190 cm, seen within the hour: man180 only (stale is out on time, tall200 on height).
  await expect.poll(() => mapIds(page)).toEqual(["man180"]);
});
