import type { Page } from "@playwright/test";
import { API_ORIGINS, sendXhr, type ApiResponses } from "./sniffies-api.js";

/**
 * Shared by the extension and userscript specs: the surfaces `core/src/profile-filter-hook.ts`
 * filters for blocked bots (map init, chat init, an opened chat thread, and live WebSocket
 * frames), served by a fake Sniffies with one blocked account and one ordinary one in each.
 */

/** 24-hex ids, like real ones; the extension's settings page validates that shape. */
export const BOT_ID = "0bad00000000000000000bad";
export const OK_ID = "0ca1000000000000000000ca";

const profile = (id: string) => ({ _id: id, data: { profile: { extended: {} } } });

export const BOT_RESPONSES: ApiResponses = {
  "/api/post-authentication": {
    nearbyVisitors: { visitors: [profile(BOT_ID), profile(OK_ID)], emitRadiusInMiles: 1 },
    partialVisitorData: [profile(BOT_ID), profile(OK_ID)],
  },
  "/api/v2/post-authentication/chat-data": {
    conversationData: {
      userIds: [BOT_ID, OK_ID],
      conversations: [
        { _id: "c1", participants: BOT_ID, author1: BOT_ID },
        { _id: "c2", participants: OK_ID, author1: OK_ID },
      ],
    },
    partialVisitorData: [profile(BOT_ID), profile(OK_ID)],
  },
  "/api/messages": {
    messages: [
      { author: BOT_ID, body: "spam" },
      { author: OK_ID, body: "hi" },
    ],
    partialUsers: [profile(BOT_ID), profile(OK_ID)],
  },
};

type WithId = { _id: string };

/** What the page sees come back from the map init. */
export const mapIds = async (page: Page, origin: string = API_ORIGINS.sameOrigin) => {
  const body = JSON.parse(await sendXhr(page, "POST", `${origin}/api/post-authentication`, {}));
  return {
    visitors: body.nearbyVisitors.visitors.map((v: WithId) => v._id) as string[],
    cards: body.partialVisitorData.map((v: WithId) => v._id) as string[],
  };
};

/** What the page sees come back from the chat init. */
export const chatIds = async (page: Page, origin: string = API_ORIGINS.sameOrigin) => {
  const body = JSON.parse(
    await sendXhr(page, "GET", `${origin}/api/v2/post-authentication/chat-data`),
  );
  return {
    userIds: body.conversationData.userIds as string[],
    conversations: body.conversationData.conversations.map(
      (c: { _id: string }) => c._id,
    ) as string[],
    cards: body.partialVisitorData.map((v: WithId) => v._id) as string[],
  };
};

/** What the page sees come back from an opened chat thread. */
export const threadIds = async (page: Page, origin: string = API_ORIGINS.sameOrigin) => {
  const body = JSON.parse(await sendXhr(page, "GET", `${origin}/api/messages?conversationId=abc`));
  return {
    authors: body.messages.map((m: { author: string }) => m.author) as string[],
    cards: body.partialUsers.map((u: WithId) => u._id) as string[],
  };
};

const FRAMES = [
  { eventName: "userJoined", data: profile(BOT_ID) },
  { eventName: "userJoined", data: profile(OK_ID) },
  { eventName: "userUpdated", data: { _id: BOT_ID } },
  { eventName: "userAwake", data: BOT_ID },
  { eventName: "userAwake", data: OK_ID },
  { eventName: "userDisconnected", data: BOT_ID },
  { eventName: "userRemoved", data: BOT_ID },
  { eventName: "newMsg", data: { message: { author: BOT_ID, body: "spam" } } },
  { eventName: "newMsg", data: { message: { author: OK_ID, body: "hi" } } },
];

/** The frames each way of listening for them actually received, as `eventName:id`. */
export interface Delivered {
  addEventListener: string[];
  onmessage: string[];
}

const label = (frame: { eventName: string; data: unknown }): string => {
  const data = frame.data as { _id?: string; message?: { author?: string } } | string;
  const id = typeof data === "string" ? data : (data._id ?? data.message?.author ?? "?");
  return `${frame.eventName}:${id}`;
};

/** The labels `FRAMES` produce for the ordinary account, which should all get through. */
export const FRAMES_FROM_OK = FRAMES.filter((frame) => label(frame).endsWith(OK_ID)).map(label);

/**
 * Has Sniffies' live socket send every frame to a page that connects to it. Call before the page
 * loads: the hooks keep the `WebSocket` they find when they inject, so a route added later is
 * never the one they connect through.
 */
export const routeLiveSocket = async (page: Page): Promise<void> => {
  await page.routeWebSocket(/prod.ws.sniffies.com/, (socket) => {
    for (const frame of FRAMES) {
      socket.send(JSON.stringify(frame));
    }
  });
};

/**
 * Connects to the live socket and returns what two page listeners (an `addEventListener` one and
 * an `onmessage` one) got: a blocked account's frames must reach neither.
 */
export const deliverFrames = async (page: Page): Promise<Delivered> => {
  const raw = await page.evaluate(
    () =>
      new Promise<{ addEventListener: unknown[]; onmessage: unknown[] }>((resolve) => {
        const received = { addEventListener: [] as unknown[], onmessage: [] as unknown[] };
        const socket = new WebSocket("wss://prod.ws.sniffies.com/?userId=me");
        socket.addEventListener("message", (event) =>
          received.addEventListener.push(JSON.parse(event.data)),
        );
        socket.onmessage = (event) => received.onmessage.push(JSON.parse(event.data));
        // The frames arrive together right after the socket opens.
        setTimeout(() => resolve(received), 500);
      }),
  );
  const labels = (frames: unknown[]): string[] =>
    (frames as { eventName: string; data: unknown }[]).map(label);
  return { addEventListener: labels(raw.addEventListener), onmessage: labels(raw.onmessage) };
};
