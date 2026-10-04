import { createLogger, type Logger } from "./log.js";
import {
  createProfileMatcher,
  type ProfileFilterRule,
  type ProfileMatcher,
} from "./profile-filter.js";
import {
  CHAT_DATA_PATH,
  MESSAGES_PATH,
  POST_AUTH_PATH,
  SOFT_RELOAD_PATH,
  WS_HOST,
  WS_USER_ID_PARAM,
  isSniffiesApiHost,
  type ChatDataPayload,
  type Conversation,
  type FilterableProfile,
  type MessagesPayload,
  type NearbyVisitorsPayload,
  type NewConversationFrame,
  type NewMsgFrame,
} from "./sniffies-api.js";

type FilterKind = "post-authentication" | "soft-reload" | "chat-data" | "messages";

const filterProfiles = (
  items: FilterableProfile[] | undefined,
  matcher: ProfileMatcher,
): FilterableProfile[] | undefined => items?.filter((item) => !matcher.hidesProfile(item));

/** Removes hidden accounts from the map init */
export const filterPostAuthenticationPayload = (
  payload: NearbyVisitorsPayload,
  matcher: ProfileMatcher,
): NearbyVisitorsPayload => {
  if (payload.nearbyVisitors?.visitors) {
    payload.nearbyVisitors.visitors = filterProfiles(payload.nearbyVisitors.visitors, matcher);
  }
  if (payload.partialVisitorData) {
    payload.partialVisitorData = filterProfiles(payload.partialVisitorData, matcher);
  }
  return payload;
};

/** Removes hidden accounts from the chat init payload's conversation lists. */
export const filterChatDataPayload = (
  payload: ChatDataPayload,
  matcher: ProfileMatcher,
): ChatDataPayload => {
  if (payload.partialVisitorData) {
    payload.partialVisitorData = filterProfiles(payload.partialVisitorData, matcher);
  }
  const isHiddenConversation = (c: Conversation): boolean => {
    let hidden = false;
    for (const id of [c.participants, c.author1, c.author2]) {
      if (id && matcher.hidesId(id)) {
        hidden = true;
      }
    }
    return hidden;
  };

  if (payload.conversationData?.conversations) {
    payload.conversationData.conversations = payload.conversationData.conversations.filter(
      (c) => !isHiddenConversation(c),
    );
  }
  if (payload.conversationData?.userIds) {
    payload.conversationData.userIds = payload.conversationData.userIds.filter(
      (id) => !matcher.hidesId(id),
    );
  }
  return payload;
};

/** Removes a hidden account's messages (and profile card) from an opened chat thread. */
export const filterMessagesPayload = (
  payload: MessagesPayload,
  matcher: ProfileMatcher,
): MessagesPayload => {
  if (payload.partialUsers) {
    payload.partialUsers = filterProfiles(payload.partialUsers, matcher);
  }
  if (payload.messages) {
    payload.messages = payload.messages.filter((m) => !(m.author && matcher.hidesId(m.author)));
  }
  return payload;
};

const applyFilter = (kind: FilterKind, payload: unknown, matcher: ProfileMatcher): unknown => {
  switch (kind) {
    case "post-authentication":
    case "soft-reload":
      return filterPostAuthenticationPayload(payload as NearbyVisitorsPayload, matcher);
    case "chat-data":
      return filterChatDataPayload(payload as ChatDataPayload, matcher);
    case "messages":
      return filterMessagesPayload(payload as MessagesPayload, matcher);
  }
};

interface WsFrameInfo {
  eventName: string;
  /** The account the frame is about: a profile when the frame carries one, else a bare id. */
  subject: FilterableProfile | string | null;
}

const asProfile = (value: unknown): FilterableProfile | null =>
  typeof (value as { _id?: unknown } | undefined)?._id === "string"
    ? (value as FilterableProfile)
    : null;

/** Pulls the event name + subject account (if any) out of a raw WS frame. */
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
  if (obj.eventName === "userJoined") {
    return { eventName: obj.eventName, subject: asProfile(obj.data) };
  }
  if (obj.eventName === "userUpdated") {
    // Carries only the changed fields, so it's judged by id against the last full profile.
    return { eventName: obj.eventName, subject: asProfile(obj.data)?._id ?? null };
  }
  if (
    obj.eventName === "userAwake" ||
    obj.eventName === "userDisconnected" ||
    obj.eventName === "userRemoved"
  ) {
    return { eventName: obj.eventName, subject: typeof obj.data === "string" ? obj.data : null };
  }
  if (obj.eventName === "newMsg") {
    const author = (obj.data as NewMsgFrame["data"] | undefined)?.message?.author;
    return { eventName: obj.eventName, subject: typeof author === "string" ? author : null };
  }
  if (obj.eventName === "newConversation") {
    const partialUser = (obj.data as NewConversationFrame["data"] | undefined)?.partialUser;
    return { eventName: obj.eventName, subject: asProfile(partialUser) };
  }
  return { eventName: obj.eventName, subject: null };
};

const hidesFrame = (frame: WsFrameInfo | null, matcher: ProfileMatcher): boolean => {
  if (!frame?.subject) {
    return false;
  }
  return typeof frame.subject === "string"
    ? matcher.hidesId(frame.subject)
    : matcher.hidesProfile(frame.subject);
};

/** Decides whether a single live WebSocket frame carries a hidden account. */
export const shouldFilterWebSocketFrame = (raw: string, matcher: ProfileMatcher): boolean =>
  matcher.isActive() && hidesFrame(parseWsFrame(raw), matcher);

// ── XHR ────────────────────────────────────────────────────────────────────

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & {
  __sniffiesBotBlockPatched?: boolean;
};
type XhrWithFilterKind = XMLHttpRequest & { __sniffiesFilterKind?: FilterKind | null };

const classifyXhrUrl = (url: string): FilterKind | null => {
  try {
    const parsed = new URL(url, typeof location !== "undefined" ? location.href : undefined);
    if (!isSniffiesApiHost(parsed.host)) {
      return null;
    }
    if (parsed.pathname === POST_AUTH_PATH) {
      return "post-authentication";
    }
    if (parsed.pathname === SOFT_RELOAD_PATH) {
      return "soft-reload";
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

const installXhrFilter = (matcher: ProfileMatcher, log: Logger): boolean => {
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
          const shouldFilter = matcher.isActive();
          log(`${kind} response read`, {
            filtering: shouldFilter,
            ms: Math.round(performance.now()),
          });
          let json: unknown;
          let text = "";
          if (responseType === "json") {
            json = responseDescriptor.get!.call(this);
          } else {
            text = responseTextDescriptor.get!.call(this) as string;
            if (shouldFilter) {
              try {
                json = JSON.parse(text);
              } catch {
                cached = { text, json: undefined };
                return cached;
              }
            }
          }
          if (shouldFilter) {
            json = applyFilter(kind, json, matcher);
            for (const { rule, ids } of matcher.flush()) {
              log.warn(`${rule} filtered account(s) from ${kind} response:`, ids);
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
  matcher: ProfileMatcher,
  nativeOnMessageDescriptor: PropertyDescriptor | undefined,
  log: Logger,
): void => {
  const shouldSuppress = (event: Event): boolean => {
    if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
      return false;
    }
    if (!matcher.isActive()) {
      return false;
    }
    const frame = parseWsFrame(event.data);
    if (!hidesFrame(frame, matcher)) {
      return false;
    }
    for (const { rule, ids } of matcher.flush()) {
      log.warn(`${rule} filtered account from WS ${frame!.eventName} frame:`, ...ids);
    }
    return true;
  };

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

const installWebSocketFilter = (matcher: ProfileMatcher, log: Logger): boolean => {
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
      // Sniffies connects with ?userId=<own id> — never hide the user from themselves.
      matcher.setSelfId(new URL(url, location.href).searchParams.get(WS_USER_ID_PARAM) ?? "");
      patchSocketInstance(socket, matcher, nativeOnMessageDescriptor, log);
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

export interface ProfileFilterHookResult {
  xhrInstalled: boolean;
  wsInstalled: boolean;
}

/** Installs the network filters that hide every profile one of `rules` rejects. */
export const installProfileFilterHook = (
  rules: readonly ProfileFilterRule[],
): ProfileFilterHookResult => {
  const log = createLogger("profile-filter");
  const matcher = createProfileMatcher(rules);
  return {
    xhrInstalled: installXhrFilter(matcher, log),
    wsInstalled: installWebSocketFilter(matcher, log),
  };
};
