import { createLogger, type Logger } from "./log.js";

// Filters blocked-bot accounts out of Sniffies' own data before the page ever
// parses it, across four reverse-engineered surfaces (see TODO.md section 5
// for the HAR-derived field paths this was built against):
//   - POST .../api/post-authentication (map init)
//   - GET  .../api/v2/post-authentication/chat-data (chat init)
//   - GET  .../api/messages?conversationId=... (an opened chat thread)
//   - wss://prod.ws.sniffies.com/ (live presence events, live 1:1 chat
//     messages via a "newMsg" frame, and new conversation threads via a
//     "newConversation" frame — confirmed by HAR, see below)
// The API host itself isn't stable: a second capture, taken minutes after the
// first, saw every /api/* call move from uswapi2.sniffies.com to
// usw.api.sniffies.com — so XHR matching is done by *path* against any
// *.sniffies.com host, not by a fixed hostname (that mismatch was the root
// cause of a real filtering miss during testing).
// This is inherently fragile: Sniffies can change any of these wire formats
// without notice, silently turning off filtering. There's no realistic way to
// unit-test the filtering logic against live Sniffies traffic — the pure
// filter/decision functions below are covered, but the actual hook only gets
// manual verification. Every successful filter logs via log.warn (so it's
// visible without flipping on __DEBUG__) naming which blocked id(s) were
// removed and from where — check the console if filtering seems to be
// missing something.

export interface BotBlockState {
  blockedIds: ReadonlySet<string>;
  enabled: boolean;
}

/** Called with the distinct blocked ids removed from a single response/frame. */
export type OnBotsFiltered = (ids: string[]) => void;

const POST_AUTH_PATH = "/api/post-authentication";
const CHAT_DATA_PATH = "/api/v2/post-authentication/chat-data";
const MESSAGES_PATH = "/api/messages";
const WS_HOST = "prod.ws.sniffies.com";

type FilterKind = "post-authentication" | "chat-data" | "messages";

interface WithId {
  _id: string;
}

interface NearbyVisitorsPayload {
  nearbyVisitors?: { visitors?: WithId[] };
  partialVisitorData?: WithId[];
  [key: string]: unknown;
}

interface Conversation {
  participants?: string;
  author1?: string;
  author2?: string | null;
  [key: string]: unknown;
}

interface ChatDataPayload {
  conversationData?: {
    conversations?: Conversation[];
    userIds?: string[];
    [key: string]: unknown;
  };
  partialVisitorData?: WithId[];
  [key: string]: unknown;
}

interface Message {
  author?: string;
  [key: string]: unknown;
}

interface MessagesPayload {
  messages?: Message[];
  partialUsers?: WithId[];
  [key: string]: unknown;
}

const filterById = <T extends WithId>(
  items: T[] | undefined,
  blockedIds: ReadonlySet<string>,
): T[] | undefined => items?.filter((item) => !blockedIds.has(item._id));

/** Removes blocked accounts from the map init payload's visitor lists. */
export const filterPostAuthenticationPayload = (
  payload: NearbyVisitorsPayload,
  blockedIds: ReadonlySet<string>,
): NearbyVisitorsPayload => {
  if (blockedIds.size === 0) {
    return payload;
  }
  if (payload.nearbyVisitors?.visitors) {
    payload.nearbyVisitors.visitors = filterById(payload.nearbyVisitors.visitors, blockedIds);
  }
  if (payload.partialVisitorData) {
    payload.partialVisitorData = filterById(payload.partialVisitorData, blockedIds);
  }
  return payload;
};

/** Removes blocked accounts from the chat init payload's conversation lists. */
export const filterChatDataPayload = (
  payload: ChatDataPayload,
  blockedIds: ReadonlySet<string>,
): ChatDataPayload => {
  if (blockedIds.size === 0) {
    return payload;
  }
  const isBlockedConversation = (c: Conversation): boolean =>
    (!!c.participants && blockedIds.has(c.participants)) ||
    (!!c.author1 && blockedIds.has(c.author1)) ||
    (!!c.author2 && blockedIds.has(c.author2));

  if (payload.conversationData?.conversations) {
    payload.conversationData.conversations = payload.conversationData.conversations.filter(
      (c) => !isBlockedConversation(c),
    );
  }
  if (payload.conversationData?.userIds) {
    payload.conversationData.userIds = payload.conversationData.userIds.filter(
      (id) => !blockedIds.has(id),
    );
  }
  if (payload.partialVisitorData) {
    payload.partialVisitorData = filterById(payload.partialVisitorData, blockedIds);
  }
  return payload;
};

/** Removes a blocked account's messages (and profile card) from an opened chat thread. */
export const filterMessagesPayload = (
  payload: MessagesPayload,
  blockedIds: ReadonlySet<string>,
): MessagesPayload => {
  if (blockedIds.size === 0) {
    return payload;
  }
  if (payload.messages) {
    payload.messages = payload.messages.filter((m) => !(m.author && blockedIds.has(m.author)));
  }
  if (payload.partialUsers) {
    payload.partialUsers = filterById(payload.partialUsers, blockedIds);
  }
  return payload;
};

const applyFilter = (
  kind: FilterKind,
  payload: unknown,
  blockedIds: ReadonlySet<string>,
): unknown => {
  switch (kind) {
    case "post-authentication":
      return filterPostAuthenticationPayload(payload as NearbyVisitorsPayload, blockedIds);
    case "chat-data":
      return filterChatDataPayload(payload as ChatDataPayload, blockedIds);
    case "messages":
      return filterMessagesPayload(payload as MessagesPayload, blockedIds);
  }
};

/**
 * Finds which blocked ids are actually present in a payload, for logging —
 * called *before* applyFilter (which removes them) so the log line can name
 * exactly who got filtered out.
 */
const collectBlockedIdsPresent = (
  kind: FilterKind,
  payload: unknown,
  blockedIds: ReadonlySet<string>,
): string[] => {
  const found = new Set<string>();
  const mark = (id: unknown): void => {
    if (typeof id === "string" && blockedIds.has(id)) {
      found.add(id);
    }
  };
  if (kind === "post-authentication") {
    const p = payload as NearbyVisitorsPayload;
    p.nearbyVisitors?.visitors?.forEach((v) => mark(v._id));
    p.partialVisitorData?.forEach((v) => mark(v._id));
  } else if (kind === "chat-data") {
    const p = payload as ChatDataPayload;
    p.conversationData?.conversations?.forEach((c) => {
      mark(c.participants);
      mark(c.author1);
      mark(c.author2);
    });
    p.conversationData?.userIds?.forEach(mark);
    p.partialVisitorData?.forEach((v) => mark(v._id));
  } else if (kind === "messages") {
    const p = payload as MessagesPayload;
    p.messages?.forEach((m) => mark(m.author));
    p.partialUsers?.forEach((v) => mark(v._id));
  }
  return [...found];
};

interface WsFrameInfo {
  eventName: string;
  id: string | null;
}

/** Pulls the event name + subject user id (if any) out of a raw WS frame. */
const parseWsFrame = (raw: string): WsFrameInfo | null => {
  let obj: { eventName?: unknown; data?: unknown };
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof obj.eventName !== "string") {
    return null;
  }
  if (obj.eventName === "userJoined" || obj.eventName === "userUpdated") {
    const id = (obj.data as { _id?: unknown } | undefined)?._id;
    return { eventName: obj.eventName, id: typeof id === "string" ? id : null };
  }
  if (
    obj.eventName === "userAwake" ||
    obj.eventName === "userDisconnected" ||
    obj.eventName === "userRemoved"
  ) {
    return { eventName: obj.eventName, id: typeof obj.data === "string" ? obj.data : null };
  }
  if (obj.eventName === "newMsg") {
    // Live 1:1 chat message. Confirmed via HAR: the app reacts to this frame
    // by immediately fetching /api/conversation/visitor for the author (and,
    // per user report, that round-trip is what causes the counterpart to see
    // a read receipt) — dropping the frame here is what actually stops that
    // chain, since we only rewrite XHR *responses* and can't intercept a
    // request that never gets sent.
    const author = (obj.data as { message?: { author?: unknown } } | undefined)?.message?.author;
    return { eventName: obj.eventName, id: typeof author === "string" ? author : null };
  }
  if (obj.eventName === "newConversation") {
    // Fires when a brand-new conversation thread starts — same leak as
    // newMsg above, just for a first message instead of one in an existing
    // thread. Confirmed via HAR: data.partialUser is the counterpart's
    // lightweight profile, the same {_id, ...} shape as partialVisitorData/
    // partialUsers elsewhere, so it's the definitive id regardless of
    // whether the blocked account is data.conversation's author1 or author2.
    const id = (obj.data as { partialUser?: { _id?: unknown } } | undefined)?.partialUser?._id;
    return { eventName: obj.eventName, id: typeof id === "string" ? id : null };
  }
  return { eventName: obj.eventName, id: null };
};

/** Decides whether a single live WebSocket frame carries a blocked account. */
export const shouldFilterWebSocketFrame = (
  raw: string,
  blockedIds: ReadonlySet<string>,
): boolean => {
  if (blockedIds.size === 0) {
    return false;
  }
  const frame = parseWsFrame(raw);
  return !!frame?.id && blockedIds.has(frame.id);
};

// ── XHR ────────────────────────────────────────────────────────────────────
// Sniffies calls these endpoints via XMLHttpRequest, not fetch (confirmed
// from the HAR). Shadowing responseText/response as instance-level accessor
// properties (rather than racing the app's own load/readystatechange
// listeners) means whenever the app reads the response, it gets the filtered
// version regardless of when that read happens.

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & {
  __sniffiesBotBlockPatched?: boolean;
};
type XhrWithFilterKind = XMLHttpRequest & { __sniffiesFilterKind?: FilterKind | null };

// Matched by path only, not hostname — see the file header on why.
const isSniffiesApiHost = (host: string): boolean =>
  host === "sniffies.com" || host.endsWith(".sniffies.com");

const classifyXhrUrl = (url: string): FilterKind | null => {
  try {
    const parsed = new URL(url, typeof location !== "undefined" ? location.href : undefined);
    if (!isSniffiesApiHost(parsed.host)) {
      return null;
    }
    if (parsed.pathname === POST_AUTH_PATH) {
      return "post-authentication";
    }
    if (parsed.pathname === CHAT_DATA_PATH) {
      return "chat-data";
    }
    if (parsed.pathname === MESSAGES_PATH) {
      return "messages";
    }
    return null;
  } catch {
    return null;
  }
};

const installXhrFilter = (
  getState: () => BotBlockState,
  onFiltered: OnBotsFiltered | undefined,
  log: Logger,
): boolean => {
  const proto = XMLHttpRequest.prototype as PatchedXHRPrototype;
  if (proto.__sniffiesBotBlockPatched) {
    log("XHR filter not installed (already patched)");
    return false;
  }

  const nativeOpen = proto.open;
  const nativeSend = proto.send;
  const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, "responseText");
  const responseDescriptor = Object.getOwnPropertyDescriptor(proto, "response");
  if (!responseTextDescriptor?.get || !responseDescriptor?.get) {
    log.warn("XHR filter not installed (responseText/response are not accessor properties)");
    return false;
  }

  proto.open = function (
    this: XhrWithFilterKind,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__sniffiesFilterKind = classifyXhrUrl(url.toString());
    return (nativeOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
  } as typeof proto.open;

  proto.send = function (this: XhrWithFilterKind, ...args: unknown[]) {
    const kind = this.__sniffiesFilterKind;
    if (kind) {
      const responseType = this.responseType || "";
      if (responseType === "" || responseType === "text" || responseType === "json") {
        let cached: { text: string; json: unknown } | null = null;
        const compute = (): { text: string; json: unknown } => {
          if (cached) {
            return cached;
          }
          const state = getState();
          let json: unknown;
          let text = "";
          if (responseType === "json") {
            json = responseDescriptor.get!.call(this);
          } else {
            text = responseTextDescriptor.get!.call(this) as string;
            try {
              json = JSON.parse(text);
            } catch {
              cached = { text, json: undefined };
              return cached;
            }
          }
          if (state.enabled && state.blockedIds.size > 0) {
            const matchedIds = collectBlockedIdsPresent(kind, json, state.blockedIds);
            json = applyFilter(kind, json, state.blockedIds);
            if (matchedIds.length > 0) {
              log.warn(`filtered blocked account(s) from ${kind} response:`, matchedIds);
              onFiltered?.(matchedIds);
            }
            if (responseType !== "json") {
              text = JSON.stringify(json);
            }
          }
          cached = { text, json };
          return cached;
        };
        if (responseType !== "json") {
          Object.defineProperty(this, "responseText", {
            configurable: true,
            get: () => compute().text,
          });
        }
        Object.defineProperty(this, "response", {
          configurable: true,
          get: () => (responseType === "json" ? compute().json : compute().text),
        });
      } else {
        log.warn(`unsupported responseType "${responseType}" for ${kind}, not filtering`);
      }
    }
    return (nativeSend as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof proto.send;

  proto.__sniffiesBotBlockPatched = true;
  log("XHR filter installed");
  return true;
};

// ── WebSocket ────────────────────────────────────────────────────────────────
// Wraps the WebSocket *instance* returned by the constructor (not just the
// connect URL, like installUserIdHook does) so blocked-account frames never
// reach the page's own message listeners — via addEventListener("message",
// ...) or the onmessage property, both of which Sniffies may use.

type PatchedWebSocketCtor = typeof WebSocket & { __sniffiesBotBlockPatched?: boolean };

const isWsTargetHost = (url: string | URL): boolean => {
  try {
    const parsed = new URL(url, typeof location !== "undefined" ? location.href : undefined);
    return parsed.host === WS_HOST;
  } catch {
    return false;
  }
};

const patchSocketInstance = (
  socket: WebSocket,
  getState: () => BotBlockState,
  onFiltered: OnBotsFiltered | undefined,
  nativeOnMessageDescriptor: PropertyDescriptor | undefined,
  log: Logger,
): void => {
  const shouldSuppress = (event: Event): boolean => {
    if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
      return false;
    }
    const state = getState();
    if (!state.enabled || state.blockedIds.size === 0) {
      return false;
    }
    const frame = parseWsFrame(event.data);
    if (frame?.id && state.blockedIds.has(frame.id)) {
      log.warn(`filtered blocked account from WS ${frame.eventName} frame:`, frame.id);
      onFiltered?.([frame.id]);
      return true;
    }
    return false;
  };

  // WebSocket's addEventListener/removeEventListener overloads (unlike the
  // base EventTarget ones) don't accept a null listener — loosen the type
  // here since we deliberately pass through whatever the caller gave us,
  // null included, rather than special-casing it.
  const nativeAddEventListener = socket.addEventListener.bind(socket) as (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  const nativeRemoveEventListener = socket.removeEventListener.bind(socket) as (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) => void;
  const wrappedListeners = new WeakMap<EventListenerOrEventListenerObject, EventListener>();

  const wrap = (listener: EventListenerOrEventListenerObject): EventListener => {
    const existing = wrappedListeners.get(listener);
    if (existing) {
      return existing;
    }
    const handle = typeof listener === "function" ? listener : listener.handleEvent.bind(listener);
    const wrapped: EventListener = (event) => {
      if (shouldSuppress(event)) {
        return;
      }
      handle(event);
    };
    wrappedListeners.set(listener, wrapped);
    return wrapped;
  };

  socket.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type !== "message" || !listener) {
      return nativeAddEventListener(type, listener, options);
    }
    return nativeAddEventListener(type, wrap(listener), options);
  }) as typeof socket.addEventListener;

  socket.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) => {
    if (type !== "message" || !listener) {
      return nativeRemoveEventListener(type, listener, options);
    }
    return nativeRemoveEventListener(type, wrappedListeners.get(listener) ?? listener, options);
  }) as typeof socket.removeEventListener;

  if (nativeOnMessageDescriptor?.get && nativeOnMessageDescriptor.set) {
    let currentHandler: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
    Object.defineProperty(socket, "onmessage", {
      configurable: true,
      enumerable: true,
      get: () => currentHandler,
      set: (handler: ((this: WebSocket, ev: MessageEvent) => unknown) | null) => {
        currentHandler = handler;
        if (typeof handler !== "function") {
          nativeOnMessageDescriptor.set!.call(socket, handler);
          return;
        }
        nativeOnMessageDescriptor.set!.call(
          socket,
          function (this: WebSocket, event: MessageEvent) {
            if (shouldSuppress(event)) {
              return;
            }
            handler.call(this, event);
          },
        );
      },
    });
  }
};

const installWebSocketFilter = (
  getState: () => BotBlockState,
  onFiltered: OnBotsFiltered | undefined,
  log: Logger,
): boolean => {
  const NativeWebSocket = (typeof WebSocket !== "undefined" ? WebSocket : undefined) as
    | PatchedWebSocketCtor
    | undefined;
  if (!NativeWebSocket || NativeWebSocket.__sniffiesBotBlockPatched) {
    log("WebSocket filter not installed (no WebSocket or already patched)");
    return false;
  }

  const nativeOnMessageDescriptor = Object.getOwnPropertyDescriptor(
    NativeWebSocket.prototype,
    "onmessage",
  );

  const PatchedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[],
  ): WebSocket {
    const socket =
      protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    if (isWsTargetHost(url)) {
      patchSocketInstance(socket, getState, onFiltered, nativeOnMessageDescriptor, log);
    }
    return socket;
  } as unknown as PatchedWebSocketCtor;

  // TODO: I hate this
  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  (PatchedWebSocket as unknown as { CONNECTING: number }).CONNECTING = NativeWebSocket.CONNECTING;
  (PatchedWebSocket as unknown as { OPEN: number }).OPEN = NativeWebSocket.OPEN;
  (PatchedWebSocket as unknown as { CLOSING: number }).CLOSING = NativeWebSocket.CLOSING;
  (PatchedWebSocket as unknown as { CLOSED: number }).CLOSED = NativeWebSocket.CLOSED;
  PatchedWebSocket.__sniffiesBotBlockPatched = true;

  window.WebSocket = PatchedWebSocket;
  log("WebSocket filter installed");
  return true;
};

export interface BotBlockHookResult {
  xhrInstalled: boolean;
  wsInstalled: boolean;
}

/**
 * Installs both filters (XHR + WebSocket). Safe to call once per page load;
 * each half no-ops if already patched.
 *
 * @param getState - Called on every intercepted response/frame, so the
 *                    blocklist and enabled flag can be updated live after
 *                    install (mirrors installGeoHook's getOverride pattern).
 *                    This hook runs at document_start, before the isolated
 *                    world has read chrome.storage and relayed the blocklist
 *                    over — until the first relay message arrives, getState()
 *                    should return `enabled: false` so early responses pass
 *                    through unfiltered rather than racing the relay.
 * @param onFiltered - Optional. Called with the distinct blocked ids removed
 *                      from a single response/frame, each time filtering
 *                      actually happens. Fires alongside (not instead of) the
 *                      log.warn diagnostic.
 */
export const installBotBlockHook = (
  getState: () => BotBlockState,
  onFiltered?: OnBotsFiltered,
): BotBlockHookResult => {
  const log = createLogger("bot-block");
  return {
    xhrInstalled: installXhrFilter(getState, onFiltered, log),
    wsInstalled: installWebSocketFilter(getState, onFiltered, log),
  };
};
