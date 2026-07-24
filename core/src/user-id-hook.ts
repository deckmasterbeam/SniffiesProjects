type PatchedWebSocketCtor = typeof WebSocket & { __sniffiesUserIdPatched?: boolean };

const WS_HOST = "prod.ws.sniffies.com";

const extractUserId = (url: string | URL): string | null => {
  try {
    const parsed = new URL(url, typeof location !== "undefined" ? location.href : undefined);
    if (parsed.host !== WS_HOST) {
      return null;
    }
    return parsed.searchParams.get("userId");
  } catch {
    return null;
  }
};

/**
 * Wraps the global WebSocket constructor to read the `userId` query param off
 * connections to prod.ws.sniffies.com — that socket carries the logged-in
 * user's own id on every connect, e.g.
 * wss://prod.ws.sniffies.com/?userId=<id>&lat=...&lng=...
 * The socket itself is left untouched; this only observes the connect URL.
 *
 * @returns false if WebSocket is unavailable or already patched.
 */
export const installUserIdHook = (onUserId: (userId: string) => void): boolean => {
  const NativeWebSocket = (typeof WebSocket !== "undefined" ? WebSocket : undefined) as
    | PatchedWebSocketCtor
    | undefined;
  if (!NativeWebSocket || NativeWebSocket.__sniffiesUserIdPatched) {
    console.log("[sniffies-user-id] hook not installed (no WebSocket or already patched)");
    return false;
  }

  const PatchedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[],
  ): WebSocket {
    const userId = extractUserId(url);
    if (userId) {
      console.log("[sniffies-user-id] observed userId on WebSocket connect", userId);
      onUserId(userId);
    }
    return protocols === undefined
      ? new NativeWebSocket(url)
      : new NativeWebSocket(url, protocols);
  } as unknown as PatchedWebSocketCtor;

  // TODO: I hate this
  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  (PatchedWebSocket as unknown as { CONNECTING: number }).CONNECTING = NativeWebSocket.CONNECTING;
  (PatchedWebSocket as unknown as { OPEN: number }).OPEN = NativeWebSocket.OPEN;
  (PatchedWebSocket as unknown as { CLOSING: number }).CLOSING = NativeWebSocket.CLOSING;
  (PatchedWebSocket as unknown as { CLOSED: number }).CLOSED = NativeWebSocket.CLOSED;
  PatchedWebSocket.__sniffiesUserIdPatched = true;

  window.WebSocket = PatchedWebSocket;
  console.log("[sniffies-user-id] hook installed");
  return true;
};
