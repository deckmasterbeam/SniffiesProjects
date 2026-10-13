import { createLogger } from "./log.js";
import { WS_HOST, WS_USER_ID_PARAM } from "./sniffies-api.js";

type PatchedWebSocketCtor = typeof WebSocket & { __sniffiesUserIdPatched?: boolean };

const extractUserId = (url: string | URL): string | null => {
  try {
    const parsed = new URL(url, typeof location !== "undefined" ? location.href : undefined);
    if (parsed.host !== WS_HOST) {
      return null;
    }
    return parsed.searchParams.get(WS_USER_ID_PARAM);
  } catch {
    return null;
  }
};

/**
 * Wraps the global WebSocket constructor to read the `userId` query param off
 * connections to prod.ws.sniffies.com
 *
 * @returns false if WebSocket is unavailable or already patched.
 */
export const installUserIdHook = (onUserId: (userId: string) => void): boolean => {
  const log = createLogger("user-id");
  const NativeWebSocket = (typeof WebSocket !== "undefined" ? WebSocket : undefined) as
    | PatchedWebSocketCtor
    | undefined;
  if (!NativeWebSocket || NativeWebSocket.__sniffiesUserIdPatched) {
    log("hook not installed (no WebSocket or already patched)");
    return false;
  }

  const PatchedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[],
  ): WebSocket {
    const userId = extractUserId(url);
    if (userId) {
      log("observed userId on WebSocket connect", userId);
      onUserId(userId);
    }
    return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
  } as unknown as PatchedWebSocketCtor;

  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  (PatchedWebSocket as unknown as { CONNECTING: number }).CONNECTING = NativeWebSocket.CONNECTING;
  (PatchedWebSocket as unknown as { OPEN: number }).OPEN = NativeWebSocket.OPEN;
  (PatchedWebSocket as unknown as { CLOSING: number }).CLOSING = NativeWebSocket.CLOSING;
  (PatchedWebSocket as unknown as { CLOSED: number }).CLOSED = NativeWebSocket.CLOSED;
  PatchedWebSocket.__sniffiesUserIdPatched = true;

  window.WebSocket = PatchedWebSocket;
  log("hook installed");
  return true;
};
