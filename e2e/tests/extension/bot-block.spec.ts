import type { BrowserContext, Page } from "@playwright/test";
import {
  BOT_ID,
  BOT_RESPONSES,
  chatIds,
  deliverFrames,
  FRAMES_FROM_OK,
  mapIds,
  OK_ID,
  routeLiveSocket,
  threadIds,
} from "../../fixtures/bot-block.js";
import { expect, SNIFFIES_ORIGIN, test } from "../../fixtures/extension.js";
import { API_ORIGINS, mockApi } from "../../fixtures/sniffies-api.js";
import { setExtensionStorage } from "../../fixtures/storage.js";

/**
 * Same checks as `tests/userscript/bot-block.spec.ts`, against the real extension: the content
 * script relays chrome.storage to the page hook by message, so state arrives a moment after load
 * and every first assertion polls for it rather than reading once.
 */

const load = async (
  context: BrowserContext,
  { enabled = true }: { enabled?: boolean } = {},
): Promise<Page> => {
  await mockApi(context, BOT_RESPONSES, Object.values(API_ORIGINS));
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  await setExtensionStorage(context, {
    sniffiesUserId: "cccccccccccccccccccccccc",
    blockedBots: [BOT_ID],
    // Recent, so the extension doesn't replace the list with the (empty) one the server stub returns.
    blockedBotsFetchedAt: Date.now(),
    botBlockingEnabled: enabled,
  });
  const page = await context.newPage();
  await routeLiveSocket(page);
  await page.goto(`${SNIFFIES_ORIGIN}/`);
  return page;
};

test("removes a blocked account from the map init", async ({ context }) => {
  const page = await load(context);
  await expect.poll(() => mapIds(page)).toEqual({ visitors: [OK_ID], cards: [OK_ID] });
});

test("removes a blocked account's conversations from the chat init", async ({ context }) => {
  const page = await load(context);
  await expect
    .poll(() => chatIds(page))
    .toEqual({ userIds: [OK_ID], conversations: ["c2"], cards: [OK_ID] });
});

test("removes a blocked account's messages from an opened chat", async ({ context }) => {
  const page = await load(context);
  await expect.poll(() => threadIds(page)).toEqual({ authors: [OK_ID], cards: [OK_ID] });
});

for (const [name, origin] of Object.entries(API_ORIGINS)) {
  // The API host has changed before: only the path may be matched, never the hostname.
  test(`filters the same paths on the ${name} host (${origin})`, async ({ context }) => {
    const page = await load(context);
    await expect.poll(() => mapIds(page, origin)).toEqual({ visitors: [OK_ID], cards: [OK_ID] });
    expect((await chatIds(page, origin)).userIds).toEqual([OK_ID]);
    expect((await threadIds(page, origin)).authors).toEqual([OK_ID]);
  });
}

test("follows bot blocking being turned off and on while the page is open", async ({ context }) => {
  const page = await load(context);
  await expect.poll(async () => (await mapIds(page)).visitors).toEqual([OK_ID]);

  await setExtensionStorage(context, { botBlockingEnabled: false });
  await expect.poll(async () => (await mapIds(page)).visitors).toEqual([BOT_ID, OK_ID]);
  expect((await threadIds(page)).authors).toEqual([BOT_ID, OK_ID]);

  await setExtensionStorage(context, { botBlockingEnabled: true });
  await expect.poll(async () => (await mapIds(page)).visitors).toEqual([OK_ID]);
});

test("filters nothing when it was already off at load", async ({ context }) => {
  const page = await load(context, { enabled: false });
  // Once the extension's state has arrived there is still nothing to filter.
  await page.waitForTimeout(500);
  expect((await mapIds(page)).visitors).toEqual([BOT_ID, OK_ID]);
});

test("never lets a blocked account's live frames reach a page listener", async ({ context }) => {
  const page = await load(context);
  await expect.poll(async () => (await mapIds(page)).visitors).toEqual([OK_ID]);

  const delivered = await deliverFrames(page);
  expect(delivered.addEventListener).toEqual(FRAMES_FROM_OK);
  expect(delivered.onmessage).toEqual(FRAMES_FROM_OK);
});
