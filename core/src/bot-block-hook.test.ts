import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterChatDataPayload,
  filterMessagesPayload,
  filterPostAuthenticationPayload,
  installBotBlockHook,
  shouldFilterWebSocketFrame,
  type BotBlockState,
} from "./bot-block-hook.js";

// ── Pure filter functions ────────────────────────────────────────────────────

describe("filterPostAuthenticationPayload", () => {
  it("removes blocked visitors from nearbyVisitors.visitors and partialVisitorData", () => {
    const payload = {
      nearbyVisitors: {
        visitors: [{ _id: "blocked1" }, { _id: "ok1" }],
      },
      partialVisitorData: [{ _id: "blocked1" }, { _id: "ok2" }],
    };
    const result = filterPostAuthenticationPayload(payload, new Set(["blocked1"]));
    expect(result.nearbyVisitors?.visitors).toEqual([{ _id: "ok1" }]);
    expect(result.partialVisitorData).toEqual([{ _id: "ok2" }]);
  });

  it("is a no-op when the blocklist is empty", () => {
    const payload = { nearbyVisitors: { visitors: [{ _id: "a" }] } };
    expect(filterPostAuthenticationPayload(payload, new Set())).toBe(payload);
  });

  it("tolerates missing fields", () => {
    expect(filterPostAuthenticationPayload({}, new Set(["a"]))).toEqual({});
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
    const result = filterChatDataPayload(payload, new Set(["blocked1", "blocked2", "blocked3"]));
    expect(result.conversationData?.conversations).toEqual([{ author1: "me", author2: "friend" }]);
    expect(result.conversationData?.userIds).toEqual(["friend"]);
    expect(result.partialVisitorData).toEqual([{ _id: "friend" }]);
  });

  it("is a no-op when the blocklist is empty", () => {
    const payload = { conversationData: { conversations: [{ participants: "a" }] } };
    expect(filterChatDataPayload(payload, new Set())).toBe(payload);
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
    const result = filterMessagesPayload(payload, new Set(["blocked1"]));
    expect(result.messages).toEqual([{ author: "me", body: "hi" }]);
    expect(result.partialUsers).toEqual([{ _id: "me" }]);
  });

  it("is a no-op when the blocklist is empty", () => {
    const payload = { messages: [{ author: "a" }] };
    expect(filterMessagesPayload(payload, new Set())).toBe(payload);
  });
});

describe("shouldFilterWebSocketFrame", () => {
  const blocked = new Set(["blocked1"]);

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
        new Set(),
      ),
    ).toBe(false);
  });
});

// ── installBotBlockHook ──────────────────────────────────────────────────────
// Both XHR and WebSocket globals are swapped for every test in this section
// (even the WebSocket-only ones) since installBotBlockHook always patches
// both — leaving the real XMLHttpRequest prototype unmocked would let it get
// permanently patched as a side effect of a WebSocket-focused test.

const makeMockWebSocketCtor = (): typeof WebSocket => {
  // onmessage must be a real prototype accessor (get/set), not a class field —
  // a class field would be an own instance property and wouldn't exercise the
  // Object.getOwnPropertyDescriptor(prototype, "onmessage") shadowing that
  // installBotBlockHook relies on, same as the real WebSocket API.
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
    open(_method: string, _url: string): void {
      // no-op: url classification happens via the patched open()
    }
    send(): void {
      // no-op: a real implementation would perform the network request here
    }
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
    // installBotBlockHook always patches XHR too — mock it here as well so
    // these WebSocket-focused tests don't leave the real global patched.
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
    // installBotBlockHook always patches WebSocket too — mock it here as well
    // so these XHR-focused tests don't leave the real global patched.
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
    xhr.open("POST", "https://uswapi2.sniffies.com/api/post-authentication?timeThreshold=1");
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

  it("matches by path against any *.sniffies.com host, not a fixed hostname", () => {
    // Regression test: Sniffies moved every /api/* call from uswapi2.sniffies.com
    // to usw.api.sniffies.com between two HAR captures taken minutes apart —
    // filtering must not depend on which one is currently in use.
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
    xhr.open("POST", "https://uswapi2.sniffies.com/api/post-authentication");
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
    xhr.open("POST", "https://uswapi2.sniffies.com/api/post-authentication");
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
    xhr.open("POST", "https://uswapi2.sniffies.com/api/post-authentication");
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
    xhr.open("POST", "https://uswapi2.sniffies.com/api/post-authentication");
    const raw = JSON.stringify({ nearbyVisitors: { visitors: [{ _id: "blocked1" }] } });
    xhr.__setRawResponse(raw);
    parseSpy.mockClear();
    xhr.send();

    expect(xhr.responseText).toBe(raw);
    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });
});
