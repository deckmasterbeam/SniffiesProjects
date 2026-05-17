// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Wraps the global WebSocket so messages from prod.ws.sniffies.com are logged.
const DEBUG = true; // Set to false to disable logging in this script.

(() => {
  const TARGET_HOST = "prod.ws.sniffies.com";
  const TAG = "[sniffies-ws]";

  if (DEBUG) {
    console.log(`${TAG} Initializing WebSocket hook for`, TARGET_HOST);
  }

  interface HookSettings {
    wsUserIdOverride: string;
    wsLatOverride: string;
    wsLngOverride: string;
  }

  let settings: HookSettings = { wsUserIdOverride: "", wsLatOverride: "", wsLngOverride: "" };

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const msg = event.data as Record<string, unknown> | null;
    if (msg?.source === "sniffies-hook-settings") {
      settings = msg.settings as HookSettings;
    }
  });

  type PatchedCtor = typeof WebSocket & { __sniffiesPatched?: boolean };

  const NativeWebSocket = window.WebSocket as PatchedCtor;
  if (!NativeWebSocket || NativeWebSocket.__sniffiesPatched) {
    return;
  }

  const isTargetUrl = (url: string | URL): boolean => {
    try {
      const parsed = new URL(url, location.href);
      return parsed.host === TARGET_HOST;
    } catch {
      return typeof url === "string" && url.includes(TARGET_HOST);
    }
  };

  const rewriteUrl = (url: string | URL): string | URL => {
    try {
      const parsed = new URL(url instanceof URL ? url.href : url);
      if (parsed.host !== TARGET_HOST) return url;
      if (settings.wsUserIdOverride) parsed.searchParams.set("userId", settings.wsUserIdOverride);
      if (settings.wsLatOverride) parsed.searchParams.set("lat", settings.wsLatOverride);
      if (settings.wsLngOverride) parsed.searchParams.set("lng", settings.wsLngOverride);
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const PatchedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[],
  ): WebSocket {
    const rewritten = rewriteUrl(url);
    const socket =
      protocols === undefined ? new NativeWebSocket(rewritten) : new NativeWebSocket(rewritten, protocols);

    if (isTargetUrl(url)) {
      console.log(`${TAG} open`, rewritten);

      socket.addEventListener("message", (event: MessageEvent) => {
        if (DEBUG) {
          console.log(`${TAG} message`, event.data);
        }
        // Forward to the isolated world via window.postMessage.
        try {
          const raw = event.data;
          const text = typeof raw === "string" ? raw : null;
          let parsed: unknown = null;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = null;
            }
          }
          window.postMessage(
            {
              source: "sniffies-ws-hook",
              kind: "message",
              raw: text,
              parsed,
            },
            "*",
          );
        } catch (err) {
          console.error(`${TAG} failed to forward message`, err);
        }
      });

      socket.addEventListener("close", (event: CloseEvent) => {
        console.log(`${TAG} close`, { code: event.code, reason: event.reason });
      });

      socket.addEventListener("error", (event: Event) => {
        console.log(`${TAG} error`, event);
      });
    }

    return socket;
  } as unknown as PatchedCtor;

  // TODO: idk why? Ask or refactor
  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  (PatchedWebSocket as unknown as { CONNECTING: number }).CONNECTING = NativeWebSocket.CONNECTING;
  (PatchedWebSocket as unknown as { OPEN: number }).OPEN = NativeWebSocket.OPEN;
  (PatchedWebSocket as unknown as { CLOSING: number }).CLOSING = NativeWebSocket.CLOSING;
  (PatchedWebSocket as unknown as { CLOSED: number }).CLOSED = NativeWebSocket.CLOSED;
  PatchedWebSocket.__sniffiesPatched = true;

  window.WebSocket = PatchedWebSocket;
  console.log(`${TAG} WebSocket hook installed`);
})();
