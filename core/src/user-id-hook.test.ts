import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installUserIdHook } from "./user-id-hook.js";

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("installUserIdHook", () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = window.WebSocket;
    window.WebSocket = makeMockWebSocketCtor();
  });

  afterEach(() => {
    window.WebSocket = originalWebSocket;
  });

  it("returns false if already patched", () => {
    (window.WebSocket as { __sniffiesUserIdPatched?: boolean }).__sniffiesUserIdPatched = true;
    expect(installUserIdHook(() => {})).toBe(false);
  });

  it("fires onUserId with the userId query param from a prod.ws.sniffies.com connection", () => {
    const onUserId = vi.fn();
    installUserIdHook(onUserId);
    new window.WebSocket(
      "wss://prod.ws.sniffies.com/?userId=694abfeb1cf11f4a71d32027&lat=47.6&lng=-122.3",
    );
    expect(onUserId).toHaveBeenCalledWith("694abfeb1cf11f4a71d32027");
  });

  it("does not fire for connections to other hosts", () => {
    const onUserId = vi.fn();
    installUserIdHook(onUserId);
    new window.WebSocket("wss://some-other-host.com/?userId=694abfeb1cf11f4a71d32027");
    expect(onUserId).not.toHaveBeenCalled();
  });

  it("does not fire when the target host has no userId param", () => {
    const onUserId = vi.fn();
    installUserIdHook(onUserId);
    new window.WebSocket("wss://prod.ws.sniffies.com/?lat=47.6&lng=-122.3");
    expect(onUserId).not.toHaveBeenCalled();
  });

  it("still constructs a working socket after patching", () => {
    installUserIdHook(() => {});
    const socket = new window.WebSocket("wss://prod.ws.sniffies.com/?userId=abc123");
    expect(socket.url).toBe("wss://prod.ws.sniffies.com/?userId=abc123");
  });
});
