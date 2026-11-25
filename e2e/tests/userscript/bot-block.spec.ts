import { expect, test, type Page } from "@playwright/test";
import {
  BOT_ID,
  BOT_RESPONSES,
  FRAMES_FROM_OK,
  OK_ID,
  chatIds,
  deliverFrames,
  mapIds,
  routeLiveSocket,
  threadIds,
} from "../../fixtures/bot-block.js";
import { API_ORIGINS, mockApi } from "../../fixtures/sniffies-api.js";
import {
  SNIFFIES_ORIGIN,
  injectUserscript,
  mockSniffiesPage,
  seedUserscriptStorage,
} from "../../fixtures/userscript.js";

const BLOCKED_KEY = "sniffies-blocked-bots";
// Recent, so the userscript doesn't go and refetch the list from the server.
const FETCHED_AT_KEY = "sniffies-blocked-bots-fetched-at";
const ENABLED_KEY = "sniffies-bot-blocking-enabled";

const load = async (
  page: Page,
  context: import("@playwright/test").BrowserContext,
  { enabled = "true", injections = 1 }: { enabled?: string; injections?: number } = {},
): Promise<void> => {
  await mockSniffiesPage(context);
  await mockApi(context, BOT_RESPONSES, Object.values(API_ORIGINS));
  // The userscript pings its own server once a socket opens; nothing here should reach it.
  await context.route("**/api/logInit", (route) =>
    route.fulfill({
      json: { ok: true },
      headers: {
        "access-control-allow-origin": SNIFFIES_ORIGIN,
        "access-control-allow-headers": "*",
      },
    }),
  );
  await seedUserscriptStorage(page, {
    [BLOCKED_KEY]: JSON.stringify([BOT_ID]),
    [FETCHED_AT_KEY]: String(Date.now()),
    [ENABLED_KEY]: enabled,
  });
  await routeLiveSocket(page);
  // The update check asks GitHub for releases; no test should depend on its answer.
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  for (let i = 0; i < injections; i++) {
    await injectUserscript(page);
  }
  await page.goto(`${SNIFFIES_ORIGIN}/`);
};

const setBlocking = async (page: Page, on: boolean): Promise<void> => {
  const panel = page.locator("#snp-panel");
  if (!(await panel.isVisible())) {
    await page.locator("#snp-fab").click();
  }
  const details = page.locator("#bot-block-details");
  if (!(await details.evaluate((el: HTMLDetailsElement) => el.open))) {
    await details.locator("summary").click();
  }
  await page.locator("#bot-block-enabled").setChecked(on);
};

test("removes a blocked account from the map init", async ({ page, context }) => {
  await load(page, context);
  expect(await mapIds(page)).toEqual({ visitors: [OK_ID], cards: [OK_ID] });
});

test("removes a blocked account's conversations from the chat init", async ({ page, context }) => {
  await load(page, context);
  expect(await chatIds(page)).toEqual({ userIds: [OK_ID], conversations: ["c2"], cards: [OK_ID] });
});

test("removes a blocked account's messages from an opened chat", async ({ page, context }) => {
  await load(page, context);
  expect(await threadIds(page)).toEqual({ authors: [OK_ID], cards: [OK_ID] });
});

for (const [name, origin] of Object.entries(API_ORIGINS)) {
  // The API host has changed before: only the path may be matched, never the hostname.
  test(`filters the same paths on the ${name} host (${origin})`, async ({ page, context }) => {
    await load(page, context);
    expect(await mapIds(page, origin)).toEqual({ visitors: [OK_ID], cards: [OK_ID] });
    expect((await chatIds(page, origin)).userIds).toEqual([OK_ID]);
    expect((await threadIds(page, origin)).authors).toEqual([OK_ID]);
  });
}

test("stops filtering while bot blocking is off in the panel, and starts again when it is on", async ({
  page,
  context,
}) => {
  await load(page, context);
  expect((await mapIds(page)).visitors).toEqual([OK_ID]);

  await setBlocking(page, false);
  expect((await mapIds(page)).visitors).toEqual([BOT_ID, OK_ID]);
  expect((await threadIds(page)).authors).toEqual([BOT_ID, OK_ID]);

  await setBlocking(page, true);
  expect((await mapIds(page)).visitors).toEqual([OK_ID]);
});

test("filters nothing when it was already off at load", async ({ page, context }) => {
  await load(page, context, { enabled: "false" });
  expect((await mapIds(page)).visitors).toEqual([BOT_ID, OK_ID]);
});

test("never lets a blocked account's live frames reach a page listener", async ({
  page,
  context,
}) => {
  await load(page, context);
  const delivered = await deliverFrames(page);
  expect(delivered.addEventListener).toEqual(FRAMES_FROM_OK);
  expect(delivered.onmessage).toEqual(FRAMES_FROM_OK);
});

test("a second injection neither mounts twice nor filters twice", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await load(page, context, { injections: 2 });

  await expect(page.locator("#snp-fab")).toHaveCount(1);
  expect(await mapIds(page)).toEqual({ visitors: [OK_ID], cards: [OK_ID] });
  expect(errors).toEqual([]);
});

test("a full pass through the panel produces no console or page errors", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  // The fixture's marker avatars point at a host that doesn't resolve, which would log a resource
  // error that has nothing to do with the userscript.
  await context.route("https://cdn.sniffies.test/**", (route) =>
    route.fulfill({ contentType: "image/jpeg", body: "" }),
  );
  await load(page, context);

  await page.locator('[data-testid="markerUserContainer"][data-within-radius="true"]').click();
  await expect(page.locator('[data-testid="cruiserNameLabel"]')).toBeVisible();
  await mapIds(page);
  await chatIds(page);
  await threadIds(page);
  await deliverFrames(page);
  await setBlocking(page, false);
  await setBlocking(page, true);
  await page.locator("#snp-close").click();

  expect(errors).toEqual([]);
});
