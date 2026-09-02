import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installUserIdLogging } from "./user-id-logger.js";

vi.mock("./shared/env.js", () => ({
  SERVER_BASE: "https://server.example",
  CLIENT_SECRET: "test-secret",
  VERSION: "1.2.3",
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeMockWebSocketCtor = (): typeof WebSocket => {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    url: string;
    constructor(url: string | URL) {
      this.url = url.toString();
    }
  }
  return MockWebSocket as unknown as typeof WebSocket;
};

const connect = (userId: string): void => {
  new window.WebSocket(`wss://prod.ws.sniffies.com/?userId=${userId}&lat=47.6&lng=-122.3`);
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("installUserIdLogging", () => {
  let originalWebSocket: typeof WebSocket;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalWebSocket = window.WebSocket;
    window.WebSocket = makeMockWebSocketCtor();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    window.WebSocket = originalWebSocket;
    vi.unstubAllGlobals();
  });

  it("returns false if the hook is already patched", () => {
    (window.WebSocket as { __sniffiesUserIdPatched?: boolean }).__sniffiesUserIdPatched = true;
    expect(installUserIdLogging()).toBe(false);
  });

  it("sends a logInit ping with clientType userscript and the package version", async () => {
    installUserIdLogging();
    connect("abc123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://server.example/api/logInit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          userId: "abc123",
          clientType: "userscript",
          version: "1.2.3",
        }),
      }),
    );
  });

  it("sends the logInit ping exactly once per install, even across multiple connections", async () => {
    installUserIdLogging();
    connect("abc123");
    connect("abc123");
    connect("xyz789");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send a ping for connections to other hosts", async () => {
    installUserIdLogging();
    new window.WebSocket("wss://some-other-host.com/?userId=abc123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the optional onUserId callback with every observed id, not just the first", () => {
    const onUserId = vi.fn();
    installUserIdLogging(onUserId);
    connect("abc123");
    connect("xyz789");
    expect(onUserId).toHaveBeenNthCalledWith(1, "abc123");
    expect(onUserId).toHaveBeenNthCalledWith(2, "xyz789");
  });
});
