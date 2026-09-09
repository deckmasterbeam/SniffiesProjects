import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installReportFeature, refreshBlockedBotsIfStale } from "./report.js";
import { getBlockedBots, setBlockedBots, setBotBlockingEnabled } from "./shared/settings.js";

vi.mock("./shared/env.js", () => ({
  SERVER_BASE: "https://server.example",
  CLIENT_SECRET: "test-secret",
  VERSION: "1.2.3",
  REPORTING_ENABLED: true,
}));

// installBotBlockHook (called by installReportFeature) patches the global
// WebSocket/XMLHttpRequest constructors and no-ops on a second call within
// the same globals — swap in fresh mocks per test so each test gets a clean
// install, mirroring core/src/bot-block-hook.test.ts's approach.
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
    addEventListener(): void {}
    removeEventListener(): void {}
  }
  return MockWebSocket as unknown as typeof WebSocket;
};

const makeMockXHRCtor = (): typeof XMLHttpRequest => {
  class MockXMLHttpRequest {
    static __sniffiesBotBlockPatched?: boolean;
    responseType = "";
    open(): void {}
    send(): void {}
  }
  return MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
};

describe("installReportFeature", () => {
  let originalWebSocket: typeof WebSocket;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    localStorage.clear();
    originalWebSocket = window.WebSocket;
    window.WebSocket = makeMockWebSocketCtor();
    originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = makeMockXHRCtor();
  });

  afterEach(() => {
    window.WebSocket = originalWebSocket;
    window.XMLHttpRequest = originalXHR;
  });

  it("starts with an empty reporter id", () => {
    const state = installReportFeature();
    expect(state.currentSniffiesUserId).toBe("");
  });

  it("seeds botBlockState from persisted settings", () => {
    setBlockedBots(["abc123"], Date.now());
    setBotBlockingEnabled(false);
    const state = installReportFeature();
    expect(state.botBlockState.enabled).toBe(false);
    expect([...state.botBlockState.blockedIds]).toEqual(["abc123"]);
  });

  it("defaults botBlockState.enabled to true when never configured", () => {
    const state = installReportFeature();
    expect(state.botBlockState.enabled).toBe(true);
    expect(state.botBlockState.blockedIds.size).toBe(0);
  });
});

describe("refreshBlockedBotsIfStale", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and persists the blocked list when never fetched before", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, userIds: ["abc123"] }) });
    const state = { currentSniffiesUserId: "", botBlockState: { blockedIds: new Set<string>(), enabled: true } };
    refreshBlockedBotsIfStale(state);
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://server.example/api/blocked-bots",
      expect.objectContaining({
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-secret" },
      }),
    );
    expect(getBlockedBots()).toEqual(["abc123"]);
    expect([...state.botBlockState.blockedIds]).toEqual(["abc123"]);
  });

  it("does not fetch when the cache is fresh", () => {
    setBlockedBots(["abc123"], Date.now());
    const state = { currentSniffiesUserId: "", botBlockState: { blockedIds: new Set<string>(), enabled: true } };
    refreshBlockedBotsIfStale(state);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches when the cache is older than 24 hours", () => {
    setBlockedBots(["abc123"], Date.now() - 25 * 60 * 60 * 1000);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, userIds: [] }) });
    const state = { currentSniffiesUserId: "", botBlockState: { blockedIds: new Set<string>(), enabled: true } };
    refreshBlockedBotsIfStale(state);
    expect(fetchMock).toHaveBeenCalled();
  });
});
