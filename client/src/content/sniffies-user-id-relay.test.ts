import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../shared/env.js", () => ({
  DEBUG: false,
  SERVER_BASE: "https://server.example",
  CLIENT_SECRET: "test-secret",
  FAVORITES_NOTIFICATIONS_ENABLED: false,
}));

const dispatchHookMessage = (data: unknown, source: WindowProxy | null = window) => {
  window.dispatchEvent(new MessageEvent("message", { data, source }));
};

const flushPromises = () => new Promise<void>((r) => setTimeout(r, 0));

let fetchMock: ReturnType<typeof vi.fn>;
// The module attaches a "message" listener as a side effect of import. Since
// jsdom's `window` outlives any single test in this file, resetModules() alone
// doesn't detach the previous test's listener — capture and remove it
// ourselves so listeners (and their closed-over `initLogged` state) don't
// accumulate across tests.
let messageListener: EventListenerOrEventListenerObject | undefined;

const loadModule = async () => {
  vi.resetModules();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  (chrome.runtime.getManifest as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    version: "1.2.3",
  });
  const addListenerSpy = vi.spyOn(window, "addEventListener");
  await import("./sniffies-user-id-relay.js");
  const registered = addListenerSpy.mock.calls.find(([type]) => type === "message");
  messageListener = registered?.[1];
  addListenerSpy.mockRestore();
};

describe("sniffies-user-id-relay", () => {
  beforeEach(loadModule);

  afterEach(() => {
    if (messageListener) {
      window.removeEventListener("message", messageListener);
      messageListener = undefined;
    }
  });

  it("persists a valid userId", async () => {
    dispatchHookMessage({ source: "sniffies-user-id-hook", userId: "abc123" });
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ sniffiesUserId: "abc123" });
  });

  it("ignores messages with the wrong source tag", async () => {
    dispatchHookMessage({ source: "some-other-script", userId: "abc123" });
    await flushPromises();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores messages with a non-string userId", async () => {
    dispatchHookMessage({ source: "sniffies-user-id-hook", userId: 12345 });
    await flushPromises();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("ignores messages not sourced from the page's own window", async () => {
    dispatchHookMessage({ source: "sniffies-user-id-hook", userId: "abc123" }, null);
    await flushPromises();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a logInit ping with clientType chrome-client and the manifest version", async () => {
    dispatchHookMessage({ source: "sniffies-user-id-hook", userId: "abc123" });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://server.example/api/logInit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          userId: "abc123",
          clientType: "chrome-client",
          version: "1.2.3",
        }),
      }),
    );
  });

  it("sends the logInit ping exactly once per script lifetime, even across multiple valid messages", async () => {
    dispatchHookMessage({ source: "sniffies-user-id-hook", userId: "abc123" });
    dispatchHookMessage({ source: "sniffies-user-id-hook", userId: "abc123" });
    dispatchHookMessage({ source: "sniffies-user-id-hook", userId: "xyz789" });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Persistence, unlike the init ping, should still happen on every message.
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(3);
  });
});
