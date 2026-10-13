import { describe, expect, it, vi } from "vitest";
import {
  apiOriginFromPastRequests,
  findConversationWith,
  hideOnePhoto,
  lookupChat,
  setAllPhotosHidden,
  type Chat,
} from "./sent-photos.js";
import type { ChatDataPayload } from "./sniffies-api.js";

const ME = "me";
const THEM = "them";

const chat: Chat = {
  apiOrigin: "https://usw.api.sniffies.com",
  conversationId: "c1",
  ownId: ME,
  recipientId: THEM,
};

const okFetch = () =>
  vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, status: 200 }) as Response,
  );

const bodyOf = (fetch: ReturnType<typeof okFetch>) =>
  JSON.parse(fetch.mock.calls[0]![1]?.body as string);

describe("hideOnePhoto", () => {
  it("posts one photo-visibility request for the photo", async () => {
    const fetch = okFetch();

    expect(await hideOnePhoto(chat, "m1", fetch)).toBeNull();

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://usw.api.sniffies.com/api/messages/photo-visibility");
    expect(init?.credentials).toBe("include");
    expect(bodyOf(fetch)).toEqual({
      conversationId: "c1",
      conversationLocation: null,
      userIdFrom: ME,
      userIdTo: THEM,
      messageId: "m1",
      isHidden: true,
      file: null,
    });
  });

  it("reports a non-2xx response", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    expect(await hideOnePhoto(chat, "m1", fetch)).toContain("429");
  });

  it("reports a network failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await hideOnePhoto(chat, "m1", fetch)).toBeTruthy();
  });
});

describe("setAllPhotosHidden", () => {
  it("posts one all-photos-visibility request for the conversation", async () => {
    const fetch = okFetch();

    expect(await setAllPhotosHidden(chat, true, fetch)).toBeNull();

    expect(fetch.mock.calls[0]![0]).toBe(
      "https://usw.api.sniffies.com/api/messages/all-photos-visibility",
    );
    expect(bodyOf(fetch)).toEqual({
      conversationId: "c1",
      conversationLocation: null,
      userIdFrom: ME,
      userIdTo: THEM,
      isHidden: true,
    });
  });

  it("sends isHidden: false to unhide", async () => {
    const fetch = okFetch();
    await setAllPhotosHidden(chat, false, fetch);
    expect(bodyOf(fetch).isHidden).toBe(false);
  });
});

const chatList = (): ChatDataPayload => ({
  conversationData: {
    conversations: [
      { _id: "c0", author1: ME, author2: "someone" },
      { _id: "c1", author1: ME, author2: THEM },
      { _id: "c2", author1: "x", author2: null },
    ],
    pinnedConversations: [{ _id: "cp", author1: THEM, author2: ME }],
  },
});

describe("findConversationWith", () => {
  it("finds the conversation and your id", () => {
    expect(findConversationWith(chatList(), THEM)).toEqual({ conversationId: "c1", ownId: ME });
  });

  it("finds your id when the profile is author1", () => {
    const list = chatList();
    list.conversationData!.conversations = [{ _id: "c9", author1: THEM, author2: ME }];
    expect(findConversationWith(list, THEM)).toEqual({ conversationId: "c9", ownId: ME });
  });

  it("looks in pinned conversations too", () => {
    const list = chatList();
    list.conversationData!.conversations = [];
    expect(findConversationWith(list, THEM)).toEqual({ conversationId: "cp", ownId: ME });
  });

  it("returns null when there's no conversation with the profile", () => {
    expect(findConversationWith(chatList(), "stranger")).toBeNull();
    expect(findConversationWith({}, THEM)).toBeNull();
  });
});

describe("lookupChat", () => {
  it("builds the chat from the chat list", async () => {
    const fetch = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: true, json: async () => chatList() }) as Response,
    );

    expect(await lookupChat(chat.apiOrigin, THEM, fetch)).toEqual(chat);
    expect(fetch.mock.calls[0]![0]).toBe(
      "https://usw.api.sniffies.com/api/v2/post-authentication/chat-data",
    );
    expect(fetch.mock.calls[0]![1]?.credentials).toBe("include");
  });

  it("returns null on a failed or unreadable response", async () => {
    expect(
      await lookupChat(chat.apiOrigin, THEM, vi.fn().mockResolvedValue({ ok: false })),
    ).toBeNull();
    expect(
      await lookupChat(chat.apiOrigin, THEM, vi.fn().mockRejectedValue(new Error("x"))),
    ).toBeNull();
  });
});

describe("apiOriginFromPastRequests", () => {
  it("finds the API host from requests made before install", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { name: "https://sniffies.com/assets/app.js" },
      { name: "https://uswapi.sniffies.com/api/post-authentication?timeThreshold=1" },
    ] as PerformanceEntry[]);
    expect(apiOriginFromPastRequests()).toBe("https://uswapi.sniffies.com");
    vi.restoreAllMocks();
  });

  it("is null when no API request has been made", () => {
    expect(apiOriginFromPastRequests()).toBeNull();
  });
});
