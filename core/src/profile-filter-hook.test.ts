import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BotBlockState } from "./contracts.js";
import {
  botBlockRule,
  createProfileMatcher,
  gateProfileFilters,
  genderRule,
  onlineRule,
  parseProfileFilters,
  profileFilterRules,
  type Gender,
  type ProfileFilters,
} from "./profile-filter.js";
import {
  filterChatDataPayload,
  filterMessagesPayload,
  filterPostAuthenticationPayload,
  installProfileFilterHook,
  shouldFilterWebSocketFrame,
} from "./profile-filter-hook.js";
import type { SniffiesGender } from "./sniffies-api.js";

const blocking = (ids: string[]) =>
  createProfileMatcher([botBlockRule(() => ({ blockedIds: new Set(ids), enabled: true }))]);

const allowingGenders = (genders: Gender[], enabled = true) =>
  createProfileMatcher([genderRule(() => ({ enabled, genders }))]);

const withGender = (_id: string, gender: SniffiesGender) => ({
  _id,
  data: { profile: { extended: { sexuality: { gender } } } },
});

const installBotBlockHook = (getState: () => BotBlockState, onFiltered?: (ids: string[]) => void) =>
  installProfileFilterHook([botBlockRule(getState, onFiltered)]);

const sniffiesPostAuth = "https://uswapi2.sniffies.com/api/post-authentication";

// ── Pure filter functions ────────────────────────────────────────────────────

describe("filterPostAuthenticationPayload", () => {
  it("removes blocked visitors from nearbyVisitors.visitors and partialVisitorData", () => {
    const payload = {
      nearbyVisitors: {
        visitors: [{ _id: "blocked1" }, { _id: "ok1" }],
      },
      partialVisitorData: [{ _id: "blocked1" }, { _id: "ok2" }],
    };
    const result = filterPostAuthenticationPayload(payload, blocking(["blocked1"]));
    expect(result.nearbyVisitors?.visitors).toEqual([{ _id: "ok1" }]);
    expect(result.partialVisitorData).toEqual([{ _id: "ok2" }]);
  });

  it("is a no-op when the blocklist is empty", () => {
    const payload = { nearbyVisitors: { visitors: [{ _id: "a" }] } };
    expect(filterPostAuthenticationPayload(payload, blocking([]))).toBe(payload);
  });

  it("tolerates missing fields", () => {
    expect(filterPostAuthenticationPayload({}, blocking(["a"]))).toEqual({});
  });
});

describe("filterChatDataPayload", () => {
  it("removes conversations by participants, author1, or author2", () => {
    const payload = {
      conversationData: {
        conversations: [
          { participants: "blocked1" },
          { author1: "blocked2" },
          { author1: "me", author2: "blocked3" },
          { author1: "me", author2: "friend" },
        ],
        userIds: ["blocked1", "blocked2", "blocked3", "friend"],
      },
      partialVisitorData: [{ _id: "blocked1" }, { _id: "friend" }],
    };
    const result = filterChatDataPayload(payload, blocking(["blocked1", "blocked2", "blocked3"]));
    expect(result.conversationData?.conversations).toEqual([{ author1: "me", author2: "friend" }]);
    expect(result.conversationData?.userIds).toEqual(["friend"]);
    expect(result.partialVisitorData).toEqual([{ _id: "friend" }]);
  });

  it("is a no-op when the blocklist is empty", () => {
    const payload = { conversationData: { conversations: [{ participants: "a" }] } };
    expect(filterChatDataPayload(payload, blocking([]))).toBe(payload);
  });
});

describe("filterMessagesPayload", () => {
  it("removes messages authored by a blocked account, and their profile card", () => {
    const payload = {
      messages: [
        { author: "blocked1", body: "spam" },
        { author: "me", body: "hi" },
      ],
      partialUsers: [{ _id: "blocked1" }, { _id: "me" }],
    };
    const result = filterMessagesPayload(payload, blocking(["blocked1"]));
    expect(result.messages).toEqual([{ author: "me", body: "hi" }]);
    expect(result.partialUsers).toEqual([{ _id: "me" }]);
  });

  it("is a no-op when the blocklist is empty", () => {
    const payload = { messages: [{ author: "a" }] };
    expect(filterMessagesPayload(payload, blocking([]))).toBe(payload);
  });
});

describe("gender rule", () => {
  it("removes profiles whose gender isn't allowed, treating null/missing as undefined", () => {
    const payload = {
      nearbyVisitors: {
        visitors: [
          withGender("m", "man"),
          withGender("f", "woman"),
          withGender("nb", "nonbinary"),
          withGender("u", null),
          { _id: "missing", data: { profile: { extended: {} } } },
        ],
      },
    };
    const ids = (allowed: Gender[]) =>
      filterPostAuthenticationPayload(
        structuredClone(payload),
        allowingGenders(allowed),
      ).nearbyVisitors?.visitors?.map((v) => v._id);
    expect(ids(["female", "nonbinary"])).toEqual(["f", "nb"]);
    expect(ids(["male"])).toEqual(["m"]);
    expect(ids(["undefined"])).toEqual(["u", "missing"]);
  });

  it("is inactive when every gender (or, defensively, none) is allowed", () => {
    expect(allowingGenders(["male", "female", "nonbinary", "undefined"]).isActive()).toBe(false);
    expect(allowingGenders([]).isActive()).toBe(false);
    expect(allowingGenders(["male"]).isActive()).toBe(true);
  });

  it("is inactive while switched off, whatever is selected", () => {
    expect(allowingGenders(["male"], false).isActive()).toBe(false);
  });

  it("only hides map markers: chats, messages and their profile cards are left alone", () => {
    const matcher = allowingGenders(["female"]);
    const frame = (eventName: string, data: unknown) => JSON.stringify({ eventName, data });

    const map = filterPostAuthenticationPayload(
      {
        nearbyVisitors: { visitors: [withGender("m", "man"), withGender("f", "woman")] },
        partialVisitorData: [withGender("m", "man"), withGender("f", "woman")],
      },
      matcher,
    );
    expect(map.nearbyVisitors?.visitors).toEqual([withGender("f", "woman")]);
    expect(map.partialVisitorData).toHaveLength(2);

    const chatData = {
      conversationData: {
        conversations: [{ participants: "m" }, { participants: "f" }],
        userIds: ["m", "f"],
      },
      partialVisitorData: [withGender("m", "man"), withGender("f", "woman")],
    };
    expect(filterChatDataPayload(structuredClone(chatData), matcher)).toEqual(chatData);

    const thread = {
      messages: [{ author: "m" }, { author: "f" }],
      partialUsers: [withGender("m", "man")],
    };
    expect(filterMessagesPayload(structuredClone(thread), matcher)).toEqual(thread);

    expect(shouldFilterWebSocketFrame(frame("newMsg", { message: { author: "m" } }), matcher)).toBe(
      false,
    );
    expect(
      shouldFilterWebSocketFrame(
        frame("newConversation", { partialUser: withGender("m", "man") }),
        matcher,
      ),
    ).toBe(false);
    expect(shouldFilterWebSocketFrame(frame("userAwake", "m"), matcher)).toBe(true);
    expect(matcher.flush()).toEqual([{ rule: "gender", ids: ["m"] }]);
  });

  it("remembers a userJoined profile for later id-only frames", () => {
    const matcher = allowingGenders(["female"]);
    const frame = (eventName: string, data: unknown) => JSON.stringify({ eventName, data });
    expect(shouldFilterWebSocketFrame(frame("userAwake", "m"), matcher)).toBe(false);
    expect(shouldFilterWebSocketFrame(frame("userJoined", withGender("m", "man")), matcher)).toBe(
      true,
    );
    expect(shouldFilterWebSocketFrame(frame("userAwake", "m"), matcher)).toBe(true);
    // userUpdated only carries changed fields — it must not be read as "gender undefined".
    expect(
      shouldFilterWebSocketFrame(
        frame("userUpdated", { _id: "f", data: { profile: {} } }),
        matcher,
      ),
    ).toBe(false);
  });

  it("never hides the logged-in user", () => {
    const matcher = allowingGenders(["female"]);
    matcher.setSelfId("me");
    const payload = {
      nearbyVisitors: { visitors: [withGender("me", "man"), withGender("m", "man")] },
    };
    const result = filterPostAuthenticationPayload(payload, matcher);
    expect(result.nearbyVisitors?.visitors).toEqual([withGender("me", "man")]);
  });

  it("reports hidden ids to the rule that hid them, once per flush", () => {
    const onBots = vi.fn();
    const matcher = createProfileMatcher([
      botBlockRule(() => ({ blockedIds: new Set(["bot"]), enabled: true }), onBots),
      genderRule(() => ({ enabled: true, genders: ["female"] })),
    ]);
    filterPostAuthenticationPayload(
      { nearbyVisitors: { visitors: [withGender("bot", "man"), withGender("m", "man")] } },
      matcher,
    );
    expect(matcher.flush()).toEqual([
      { rule: "bot-block", ids: ["bot"] },
      { rule: "gender", ids: ["m"] },
    ]);
    expect(onBots).toHaveBeenCalledExactlyOnceWith(["bot"]);
    expect(matcher.flush()).toEqual([]);
  });
});

describe("height and weight rules", () => {
  const withStats = (_id: string, heightInCm: number | null, weightInKg: number | null) => ({
    _id,
    data: { profile: { extended: { stats: { heightInCm, weightInKg } } } },
  });
  const visitors = [
    withStats("short-light", 165, 60),
    withStats("mid", 178, 75),
    withStats("tall-heavy", 196, 110),
    withStats("no-height", null, 75),
    withStats("no-weight", 178, null),
    { _id: "no-stats", data: { profile: { extended: {} } } },
  ];
  const shownWith = (overrides: Partial<ProfileFilters>, enabled = true) => {
    const filters = gateProfileFilters({ ...parseProfileFilters(null), ...overrides }, enabled);
    const matcher = createProfileMatcher(profileFilterRules(() => filters));
    return filterPostAuthenticationPayload(
      { nearbyVisitors: { visitors: structuredClone(visitors) } },
      matcher,
    ).nearbyVisitors?.visitors?.map((v) => v._id);
  };
  const all = visitors.map((v) => v._id);
  const range = (
    min: number | null,
    max: number | null,
    enabled = true,
    includeUnspecified = false,
  ) => ({ enabled, min, max, metric: true, includeUnspecified });

  it("keeps only profiles inside the inclusive range, hiding ones that don't state a value", () => {
    expect(shownWith({ height: range(178, 196) })).toEqual(["mid", "tall-heavy", "no-weight"]);
    expect(shownWith({ weight: range(60, 75) })).toEqual(["short-light", "mid", "no-height"]);
  });

  it("keeps profiles that don't state a value when asked to include them", () => {
    expect(shownWith({ height: range(178, 196, true, true) })).toEqual([
      "mid",
      "tall-heavy",
      "no-height",
      "no-weight",
      "no-stats",
    ]);
    expect(shownWith({ weight: range(60, 75, true, true) })).toEqual([
      "short-light",
      "mid",
      "no-height",
      "no-weight",
      "no-stats",
    ]);
  });

  it("treats a missing bound as unbounded", () => {
    expect(shownWith({ height: range(170, null) })).toEqual(["mid", "tall-heavy", "no-weight"]);
    expect(shownWith({ weight: range(null, 75) })).toEqual(["short-light", "mid", "no-height"]);
  });

  it("combines with the other filters: a profile has to pass all of them", () => {
    expect(shownWith({ height: range(170, null), weight: range(null, 100) })).toEqual(["mid"]);
  });

  it("hides nothing while off, without bounds, or with the master switch off", () => {
    expect(shownWith({ height: range(178, 196, false) })).toEqual(all);
    expect(shownWith({ height: range(null, null) })).toEqual(all);
    expect(shownWith({ height: range(178, 196) }, false)).toEqual(all);
  });
});

describe("shouldFilterWebSocketFrame", () => {
  const blocked = blocking(["blocked1"]);

  it("filters userJoined/userUpdated when data._id is blocked", () => {
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "userJoined", data: { _id: "blocked1" } }),
        blocked,
      ),
    ).toBe(true);
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "userUpdated", data: { _id: "blocked1" } }),
        blocked,
      ),
    ).toBe(true);
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "userJoined", data: { _id: "ok" } }),
        blocked,
      ),
    ).toBe(false);
  });

  it("filters userAwake/userDisconnected/userRemoved when the bare id is blocked", () => {
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "userAwake", data: "blocked1" }),
        blocked,
      ),
    ).toBe(true);
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "userDisconnected", data: "blocked1" }),
        blocked,
      ),
    ).toBe(true);
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "userRemoved", data: "blocked1" }),
        blocked,
      ),
    ).toBe(true);
    expect(
      shouldFilterWebSocketFrame(JSON.stringify({ eventName: "userAwake", data: "ok" }), blocked),
    ).toBe(false);
  });

  it("filters newMsg (live 1:1 chat) when data.message.author is blocked", () => {
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "newMsg", data: { message: { author: "blocked1" } } }),
        blocked,
      ),
    ).toBe(true);
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "newMsg", data: { message: { author: "ok" } } }),
        blocked,
      ),
    ).toBe(false);
  });

  it("filters newConversation (new chat thread) when data.partialUser._id is blocked", () => {
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({
          eventName: "newConversation",
          data: {
            conversation: { participants: "blocked1ok", author1: "blocked1" },
            submittedMessage: { author: "blocked1" },
            partialUser: { _id: "blocked1" },
          },
        }),
        blocked,
      ),
    ).toBe(true);
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({
          eventName: "newConversation",
          data: {
            conversation: { participants: "okok2", author1: "ok" },
            submittedMessage: { author: "ok" },
            partialUser: { _id: "ok" },
          },
        }),
        blocked,
      ),
    ).toBe(false);
  });

  it("passes through unknown event names, unparseable frames, and an empty blocklist", () => {
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "somethingElse", data: "blocked1" }),
        blocked,
      ),
    ).toBe(false);
    expect(shouldFilterWebSocketFrame("2", blocked)).toBe(false);
    expect(
      shouldFilterWebSocketFrame(
        JSON.stringify({ eventName: "userAwake", data: "blocked1" }),
        blocking([]),
      ),
    ).toBe(false);
  });
});

const makeMockWebSocketCtor = (): typeof WebSocket => {
  const onmessageStore = new WeakMap<object, ((ev: MessageEvent) => unknown) | null>();
  class MockWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    url: string;
    constructor(url: string | URL) {
      super();
      this.url = url.toString();
      onmessageStore.set(this, null);
    }
    get onmessage(): ((ev: MessageEvent) => unknown) | null {
      return onmessageStore.get(this) ?? null;
    }
    set onmessage(handler: ((ev: MessageEvent) => unknown) | null) {
      onmessageStore.set(this, handler);
    }
    override dispatchEvent(event: Event): boolean {
      const result = super.dispatchEvent(event);
      if (event instanceof MessageEvent) {
        onmessageStore.get(this)?.(event);
      }
      return result;
    }
  }
  return MockWebSocket as unknown as typeof WebSocket;
};

const makeMockXHRCtor = (): typeof XMLHttpRequest => {
  class MockXMLHttpRequest {
    static __sniffiesBotBlockPatched?: boolean;
    responseType = "";
    private _responseText = "";
    get responseText(): string {
      return this._responseText;
    }
    get response(): unknown {
      return this._responseText;
    }
    open(_method: string, _url: string): void {}
    send(): void {}
    __setRawResponse(text: string): void {
      this._responseText = text;
    }
  }
  return MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
};

describe("installBotBlockHook — WebSocket", () => {
  let originalWebSocket: typeof WebSocket;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    originalWebSocket = window.WebSocket;
    window.WebSocket = makeMockWebSocketCtor();
    originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = makeMockXHRCtor();
  });

  afterEach(() => {
    window.WebSocket = originalWebSocket;
    window.XMLHttpRequest = originalXHR;
  });

  const state: BotBlockState = { blockedIds: new Set(["blocked1"]), enabled: true };

  it("suppresses blocked frames delivered via addEventListener", () => {
    const result = installBotBlockHook(() => state);
    expect(result.wsInstalled).toBe(true);

    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=me");
    const received: string[] = [];
    socket.addEventListener("message", (event) => {
      received.push((event as MessageEvent).data as string);
    });

    socket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ eventName: "userAwake", data: "blocked1" }),
      }),
    );
    socket.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ eventName: "userAwake", data: "ok" }) }),
    );

    expect(received).toEqual([JSON.stringify({ eventName: "userAwake", data: "ok" })]);
  });

  it("suppresses a live newMsg frame from a blocked account's conversation", () => {
    installBotBlockHook(() => state);
    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=me");
    const received: unknown[] = [];
    socket.addEventListener("message", (event) => {
      received.push(JSON.parse((event as MessageEvent).data as string));
    });

    const blockedMsg = JSON.stringify({
      eventName: "newMsg",
      data: { message: { author: "blocked1", body: "spam" } },
    });
    const okMsg = JSON.stringify({
      eventName: "newMsg",
      data: { message: { author: "ok", body: "hi" } },
    });
    socket.dispatchEvent(new MessageEvent("message", { data: blockedMsg }));
    socket.dispatchEvent(new MessageEvent("message", { data: okMsg }));

    expect(received).toEqual([JSON.parse(okMsg)]);
  });

  it("suppresses a live newConversation frame started by a blocked account", () => {
    installBotBlockHook(() => state);
    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=me");
    const received: unknown[] = [];
    socket.addEventListener("message", (event) => {
      received.push(JSON.parse((event as MessageEvent).data as string));
    });

    const blockedMsg = JSON.stringify({
      eventName: "newConversation",
      data: {
        conversation: { participants: "blocked1me", author1: "blocked1" },
        submittedMessage: { author: "blocked1", body: "spam" },
        partialUser: { _id: "blocked1" },
      },
    });
    const okMsg = JSON.stringify({
      eventName: "newConversation",
      data: {
        conversation: { participants: "okme", author1: "ok" },
        submittedMessage: { author: "ok", body: "hi" },
        partialUser: { _id: "ok" },
      },
    });
    socket.dispatchEvent(new MessageEvent("message", { data: blockedMsg }));
    socket.dispatchEvent(new MessageEvent("message", { data: okMsg }));

    expect(received).toEqual([JSON.parse(okMsg)]);
  });

  it("suppresses blocked frames delivered via onmessage", () => {
    installBotBlockHook(() => state);
    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=me");
    const received: string[] = [];
    socket.onmessage = (event) => {
      received.push(event.data as string);
    };

    socket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ eventName: "userAwake", data: "blocked1" }),
      }),
    );
    socket.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ eventName: "userAwake", data: "ok" }) }),
    );

    expect(received).toEqual([JSON.stringify({ eventName: "userAwake", data: "ok" })]);
  });

  it("does not patch instances for other hosts", () => {
    installBotBlockHook(() => state);
    const socket = new window.WebSocket("wss://some-other-host.com/");
    const received: string[] = [];
    socket.addEventListener("message", (event) =>
      received.push((event as MessageEvent).data as string),
    );
    socket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ eventName: "userAwake", data: "blocked1" }),
      }),
    );
    expect(received).toEqual([JSON.stringify({ eventName: "userAwake", data: "blocked1" })]);
  });

  it("returns wsInstalled: false if already patched", () => {
    installBotBlockHook(() => state);
    const result = installBotBlockHook(() => state);
    expect(result.wsInstalled).toBe(false);
  });

  it("respects enabled: false", () => {
    installBotBlockHook(() => ({ blockedIds: new Set(["blocked1"]), enabled: false }));
    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=me");
    const received: string[] = [];
    socket.addEventListener("message", (event) =>
      received.push((event as MessageEvent).data as string),
    );
    socket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ eventName: "userAwake", data: "blocked1" }),
      }),
    );
    expect(received).toEqual([JSON.stringify({ eventName: "userAwake", data: "blocked1" })]);
  });

  it("logs the filtered account id and event name, via console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    installBotBlockHook(() => state);
    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=me");
    socket.addEventListener("message", () => {});
    socket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ eventName: "userJoined", data: { _id: "blocked1" } }),
      }),
    );

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.flat().join(" ")).toContain("userJoined");
    expect(warnSpy.mock.calls.flat()).toContain("blocked1");
    warnSpy.mockRestore();
  });

  it("calls onFiltered with the filtered id", () => {
    const onFiltered = vi.fn();
    installBotBlockHook(() => state, onFiltered);
    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=me");
    socket.addEventListener("message", () => {});
    socket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ eventName: "userAwake", data: "blocked1" }),
      }),
    );
    socket.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ eventName: "userAwake", data: "ok" }) }),
    );

    expect(onFiltered).toHaveBeenCalledTimes(1);
    expect(onFiltered).toHaveBeenCalledWith(["blocked1"]);
  });
});

describe("installBotBlockHook — XHR", () => {
  let originalXHR: typeof XMLHttpRequest;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = makeMockXHRCtor();
    originalWebSocket = window.WebSocket;
    window.WebSocket = makeMockWebSocketCtor();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
    window.WebSocket = originalWebSocket;
  });

  const state: BotBlockState = { blockedIds: new Set(["blocked1"]), enabled: true };

  it("filters the post-authentication response for a matching URL", () => {
    const result = installBotBlockHook(() => state);
    expect(result.xhrInstalled).toBe(true);

    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", `${sniffiesPostAuth}?timeThreshold=1`);
    xhr.__setRawResponse(
      JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }, { _id: "ok1" }] } }),
    );
    xhr.send();

    expect(JSON.parse(xhr.responseText)).toEqual({
      nearbyVisitors: { visitors: [{ _id: "ok1" }] },
    });
  });

  it("filters the chat-data response for a matching URL", () => {
    installBotBlockHook(() => state);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("GET", "https://uswapi2.sniffies.com/api/v2/post-authentication/chat-data");
    xhr.__setRawResponse(
      JSON.stringify({ conversationData: { userIds: ["blocked1", "ok1"], conversations: [] } }),
    );
    xhr.send();

    expect(JSON.parse(xhr.responseText)).toEqual({
      conversationData: { userIds: ["ok1"], conversations: [] },
    });
  });

  it("filters the messages response for a matching URL", () => {
    installBotBlockHook(() => state);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("GET", "https://uswapi2.sniffies.com/api/messages?conversationId=abc");
    xhr.__setRawResponse(
      JSON.stringify({
        messages: [
          { author: "blocked1", body: "spam" },
          { author: "ok1", body: "hi" },
        ],
        partialUsers: [{ _id: "blocked1" }, { _id: "ok1" }],
      }),
    );
    xhr.send();

    expect(JSON.parse(xhr.responseText)).toEqual({
      messages: [{ author: "ok1", body: "hi" }],
      partialUsers: [{ _id: "ok1" }],
    });
  });

  it("filters the softReload (Cruise this area) response like the map init", () => {
    installBotBlockHook(() => state);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", "https://uswapi.sniffies.com/api/softReload");
    xhr.__setRawResponse(
      JSON.stringify({
        nearbyVisitors: { visitors: [{ _id: "blocked1" }, { _id: "ok1" }] },
        partialVisitorData: [{ _id: "blocked1" }, { _id: "ok2" }],
      }),
    );
    xhr.send();

    expect(JSON.parse(xhr.responseText)).toEqual({
      nearbyVisitors: { visitors: [{ _id: "ok1" }] },
      partialVisitorData: [{ _id: "ok2" }],
    });
  });

  it("matches by path against any *.sniffies.com host, not a fixed hostname", () => {
    installBotBlockHook(() => state);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", "https://usw.api.sniffies.com/api/post-authentication?timeThreshold=1");
    xhr.__setRawResponse(
      JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }, { _id: "ok1" }] } }),
    );
    xhr.send();

    expect(JSON.parse(xhr.responseText)).toEqual({
      nearbyVisitors: { visitors: [{ _id: "ok1" }] },
    });
  });

  it("leaves unrelated URLs untouched", () => {
    installBotBlockHook(() => state);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("GET", "https://uswapi2.sniffies.com/api/some-other-endpoint");
    xhr.__setRawResponse(JSON.stringify({ foo: "bar" }));
    xhr.send();
    expect(xhr.responseText).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("leaves a matching path on a non-sniffies.com host untouched", () => {
    installBotBlockHook(() => state);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", "https://evil.example.com/api/post-authentication");
    xhr.__setRawResponse(JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }] } }));
    xhr.send();
    expect(JSON.parse(xhr.responseText)).toEqual({
      nearbyVisitors: { visitors: [{ _id: "blocked1" }] },
    });
  });

  it("returns xhrInstalled: false if already patched", () => {
    installBotBlockHook(() => state);
    const result = installBotBlockHook(() => state);
    expect(result.xhrInstalled).toBe(false);
  });

  it("logs which blocked id(s) were filtered out, via console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    installBotBlockHook(() => state);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", sniffiesPostAuth);
    xhr.__setRawResponse(
      JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }, { _id: "ok1" }] } }),
    );
    xhr.send();
    void xhr.responseText; // triggers the lazy compute()

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.flat()).toContainEqual(["blocked1"]);
    warnSpy.mockRestore();
  });

  it("calls onFiltered with the matched ids", () => {
    const onFiltered = vi.fn();
    installBotBlockHook(() => state, onFiltered);
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", sniffiesPostAuth);
    xhr.__setRawResponse(
      JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }, { _id: "ok1" }] } }),
    );
    xhr.send();
    void xhr.responseText; // triggers the lazy compute()

    expect(onFiltered).toHaveBeenCalledTimes(1);
    expect(onFiltered).toHaveBeenCalledWith(["blocked1"]);
  });

  it("does not JSON.parse the response body when disabled (nothing to filter)", () => {
    const parseSpy = vi.spyOn(JSON, "parse");
    installBotBlockHook(() => ({ blockedIds: new Set(["blocked1"]), enabled: false }));
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", sniffiesPostAuth);
    const raw = JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }] } });
    xhr.__setRawResponse(raw);
    parseSpy.mockClear(); // ignore the JSON.stringify/parse round trip used to build `raw` above
    xhr.send();

    expect(xhr.responseText).toBe(raw);
    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });

  it("does not JSON.parse the response body when the blocklist is empty", () => {
    const parseSpy = vi.spyOn(JSON, "parse");
    installBotBlockHook(() => ({ blockedIds: new Set(), enabled: true }));
    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & {
      __setRawResponse: (t: string) => void;
    };
    xhr.open("POST", sniffiesPostAuth);
    const raw = JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }] } });
    xhr.__setRawResponse(raw);
    parseSpy.mockClear();
    xhr.send();

    expect(xhr.responseText).toBe(raw);
    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });
});

describe("online rule", () => {
  const SINCE = Date.parse("2026-10-08T06:00:00Z");
  const seenAt = (_id: string, connectUpdateTime?: string) => ({
    _id,
    data: { connectUpdateTime },
  });
  const matcher = () => createProfileMatcher([onlineRule(() => ({ enabled: true, since: SINCE }))]);
  const frame = (eventName: string, data: unknown) => JSON.stringify({ eventName, data });

  it("hides profiles last online before the cutoff, or with no time at all", () => {
    const payload = {
      nearbyVisitors: {
        visitors: [
          seenAt("recent", "2026-10-08T06:30:00Z"),
          seenAt("exact", "2026-10-08T06:00:00Z"),
          seenAt("old", "2026-10-08T05:59:59Z"),
          seenAt("none"),
        ],
      },
    };
    const result = filterPostAuthenticationPayload(payload, matcher());
    expect(result.nearbyVisitors?.visitors?.map((p) => p._id)).toEqual(["recent", "exact"]);
  });

  it("is inactive when disabled or empty", () => {
    for (const filter of [
      { enabled: false, since: SINCE },
      { enabled: true, since: null },
    ]) {
      expect(createProfileMatcher([onlineRule(() => filter)]).isActive()).toBe(false);
    }
  });

  it("lets a hidden account back in when a userUpdated frame shows it came online", () => {
    const m = matcher();
    expect(
      shouldFilterWebSocketFrame(frame("userJoined", seenAt("a", "2026-10-08T05:00:00Z")), m),
    ).toBe(true);
    const update = { _id: "a", data: { connectUpdateTime: "2026-10-08T06:10:00Z", profile: {} } };
    expect(shouldFilterWebSocketFrame(frame("userUpdated", update), m)).toBe(false);
    expect(shouldFilterWebSocketFrame(frame("userAwake", "a"), m)).toBe(false);
  });

  it("swallows disconnects and removals so accounts that go offline after the cutoff stay on the map", () => {
    const m = matcher();
    shouldFilterWebSocketFrame(frame("userJoined", seenAt("a", "2026-10-08T06:10:00Z")), m);
    expect(shouldFilterWebSocketFrame(frame("userDisconnected", "a"), m)).toBe(true);
    expect(shouldFilterWebSocketFrame(frame("userDisconnected", "unseen"), m)).toBe(true);
    expect(shouldFilterWebSocketFrame(frame("userRemoved", "a"), m)).toBe(true);
    expect(shouldFilterWebSocketFrame(frame("userAwake", "a"), m)).toBe(false);
    // Off, the app sees disconnects as usual.
    const off = createProfileMatcher([onlineRule(() => ({ enabled: false, since: SINCE }))]);
    expect(shouldFilterWebSocketFrame(frame("userDisconnected", "a"), off)).toBe(false);
    expect(shouldFilterWebSocketFrame(frame("userRemoved", "a"), off)).toBe(false);
  });

  it("is saved with the other filters and gated off by the master switch", () => {
    const parsed = parseProfileFilters({ online: { enabled: true, since: SINCE } });
    expect(parsed.online).toEqual({ enabled: true, since: SINCE });
    expect(parseProfileFilters({ online: { enabled: true } }).online).toEqual({
      enabled: false,
      since: null,
    });
    expect(gateProfileFilters(parsed, false).online).toEqual({ enabled: false, since: SINCE });
  });
});

describe("unexpected profile shape", () => {
  it("warns once per missing field, never for fields that are merely null", async () => {
    vi.resetModules();
    const { createProfileMatcher: create } = await import("./profile-filter.js");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const full = (_id: string) => ({
      _id,
      data: {
        connectUpdateTime: "2026-10-08T06:00:00Z",
        profile: {
          extended: { sexuality: { gender: null }, stats: { heightInCm: null, weightInKg: null } },
        },
      },
    });
    const matcher = create([]);
    matcher.hidesProfile(full("ok"));
    expect(warnSpy).not.toHaveBeenCalled();

    matcher.hidesProfile({ _id: "a", data: { profile: {} } });
    matcher.hidesProfile({ _id: "b", data: { profile: {} } });
    const text = warnSpy.mock.calls.map((c) => c.join(" "));
    expect(text).toHaveLength(4);
    expect(text[0]).toContain("profile a has no data.connectUpdateTime");
    warnSpy.mockRestore();
  });
});

describe("unexpected payload shape", () => {
  it("warns once per missing list or malformed frame", async () => {
    vi.resetModules();
    const hook = await import("./profile-filter-hook.js");
    const { createProfileMatcher: create } = await import("./profile-filter.js");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const matcher = create([]);
    const texts = () => warnSpy.mock.calls.map((c) => c.join(" "));

    hook.filterPostAuthenticationPayload(
      { nearbyVisitors: { visitors: [] }, partialVisitorData: [] },
      matcher,
    );
    hook.filterMessagesPayload({ messages: [], partialUsers: [] }, matcher);
    expect(warnSpy).not.toHaveBeenCalled();

    hook.filterPostAuthenticationPayload({}, matcher);
    hook.filterPostAuthenticationPayload({}, matcher);
    expect(texts()).toHaveLength(2);
    expect(texts()[0]).toContain("no nearbyVisitors.visitors list");

    const { genderRule: gender } = await import("./profile-filter.js");
    const active = create([gender(() => ({ enabled: true, genders: ["female"] }))]);
    hook.shouldFilterWebSocketFrame(JSON.stringify({ eventName: "userAwake", data: 5 }), active);
    hook.shouldFilterWebSocketFrame(JSON.stringify({ eventName: "userJoined", data: {} }), active);
    expect(texts()).toHaveLength(4);
    expect(texts()[2]).toContain("userAwake frame has no string id");
    warnSpy.mockRestore();
  });
});
