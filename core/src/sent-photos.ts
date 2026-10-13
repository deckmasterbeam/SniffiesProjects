import { createLogger } from "./log.js";
import {
  ALL_PHOTOS_VISIBILITY_PATH,
  CHAT_DATA_PATH,
  MESSAGES_PATH,
  PHOTO_VISIBILITY_PATH,
  isSniffiesApiHost,
  type AllPhotosVisibilityBody,
  type ChatDataPayload,
  type Message,
  type MessagesPayload,
  type PhotoVisibilityBody,
} from "./sniffies-api.js";

const log = createLogger("sent-photos");

/** The most recently loaded chat thread. */
export interface ThreadSnapshot {
  apiOrigin: string;
  conversationId: string;
  messages: Message[];
  /** The profile cards Sniffies sent with the thread; used to find the recipient. */
  partialUserIds: string[];
}

/** Everything a hide request needs to know about one chat. */
export interface Chat {
  apiOrigin: string;
  conversationId: string;
  ownId: string;
  recipientId: string;
}

const NO_CHAT_ERROR = "Couldn't find this chat. Reopen it, then try again.";

const findRecipient = (thread: ThreadSnapshot, ownId: string): string | undefined =>
  thread.messages.find((m) => m.author && m.author !== ownId)?.author ??
  thread.partialUserIds.find((id) => id !== ownId);

export const findConversationWith = (
  payload: ChatDataPayload,
  profileId: string,
): { conversationId: string; ownId: string } | null => {
  const { conversations = [], pinnedConversations = [] } = payload.conversationData ?? {};
  for (const c of [...conversations, ...pinnedConversations]) {
    const ownId = c.author1 === profileId ? c.author2 : c.author2 === profileId ? c.author1 : null;
    if (ownId && c._id) {
      return { conversationId: c._id, ownId };
    }
  }
  return null;
};

export const lookupChat = async (
  apiOrigin: string,
  profileId: string,
  doFetch: typeof fetch = window.fetch.bind(window),
): Promise<Chat | null> => {
  try {
    const res = await doFetch(`${apiOrigin}${CHAT_DATA_PATH}`, {
      credentials: "include",
      headers: { "ngsw-bypass": "true" },
    });
    if (!res.ok) {
      return null;
    }
    const found = findConversationWith((await res.json()) as ChatDataPayload, profileId);
    return found && { apiOrigin, recipientId: profileId, ...found };
  } catch (err) {
    log.warn("chat list lookup failed:", err);
    return null;
  }
};

const postVisibility = async (
  chat: Chat,
  path: string,
  body: PhotoVisibilityBody | AllPhotosVisibilityBody,
  doFetch: typeof fetch,
): Promise<string | null> => {
  try {
    const res = await doFetch(`${chat.apiOrigin}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "ngsw-bypass": "true" },
      body: JSON.stringify(body),
    });
    return res.ok ? null : `Sniffies rejected a request (${res.status}).`;
  } catch (err) {
    log.warn("hide request failed:", err);
    return "A request failed; check your connection.";
  }
};

export const hideOnePhoto = (
  chat: Chat,
  messageId: string,
  doFetch: typeof fetch = window.fetch.bind(window),
): Promise<string | null> =>
  postVisibility(
    chat,
    PHOTO_VISIBILITY_PATH,
    {
      conversationId: chat.conversationId,
      conversationLocation: null,
      userIdFrom: chat.ownId,
      userIdTo: chat.recipientId,
      messageId,
      isHidden: true,
      file: null,
    },
    doFetch,
  );

export const setAllPhotosHidden = (
  chat: Chat,
  isHidden: boolean,
  doFetch: typeof fetch = window.fetch.bind(window),
): Promise<string | null> =>
  postVisibility(
    chat,
    ALL_PHOTOS_VISIBILITY_PATH,
    {
      conversationId: chat.conversationId,
      conversationLocation: null,
      userIdFrom: chat.ownId,
      userIdTo: chat.recipientId,
      isHidden,
    },
    doFetch,
  );

export interface SentPhotoHider {
  hideOne: (messageId: string, profileId: string | null) => Promise<string | null>;
  setAllHidden: (profileId: string, isHidden: boolean) => Promise<string | null>;
}

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & {
  __sniffiesSentPhotosPatched?: boolean;
};
type XhrWithUrl = XMLHttpRequest & { __sniffiesApiUrl?: URL | null };

const parseApiUrl = (url: string): URL | null => {
  try {
    const parsed = new URL(url, location.href);
    return isSniffiesApiHost(parsed.host) && parsed.pathname.startsWith("/api/") ? parsed : null;
  } catch {
    return null;
  }
};

export const apiOriginFromPastRequests = (): string | null => {
  for (const entry of performance.getEntriesByType("resource")) {
    const url = parseApiUrl(entry.name);
    if (url) {
      return url.origin;
    }
  }
  return null;
};

export const installSentPhotoHider = (getOwnUserId: () => string): SentPhotoHider => {
  let thread: ThreadSnapshot | null = null;
  let apiOrigin: string | null = null;
  const lookedUp = new Map<string, Chat>();

  const proto = XMLHttpRequest.prototype as PatchedXHRPrototype;
  if (!proto.__sniffiesSentPhotosPatched) {
    proto.__sniffiesSentPhotosPatched = true;
    const nativeOpen = proto.open;
    const nativeSend = proto.send;

    proto.open = function (
      this: XhrWithUrl,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      this.__sniffiesApiUrl = parseApiUrl(url.toString());
      if (this.__sniffiesApiUrl) {
        apiOrigin = this.__sniffiesApiUrl.origin;
      }
      return (nativeOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
    } as typeof proto.open;

    proto.send = function (this: XhrWithUrl, ...args: unknown[]) {
      const url = this.__sniffiesApiUrl;
      const conversationId =
        url?.pathname === MESSAGES_PATH ? url.searchParams.get("conversationId") : null;
      if (url && conversationId) {
        this.addEventListener("load", () => {
          try {
            const payload = (
              this.responseType === "json" ? this.response : JSON.parse(this.responseText)
            ) as MessagesPayload;
            if (!Array.isArray(payload?.messages)) {
              return;
            }
            thread = {
              apiOrigin: url.origin,
              conversationId,
              messages: payload.messages,
              partialUserIds: (payload.partialUsers ?? []).map((u) => u._id),
            };
          } catch {
            // not a thread we can read; keep the previous one
          }
        });
      }
      return (nativeSend as (...a: unknown[]) => unknown).apply(this, args);
    } as typeof proto.send;
  }

  const resolveChat = async (profileId: string | null): Promise<Chat | null> => {
    const ownId = getOwnUserId();
    if (thread && ownId) {
      const recipientId = findRecipient(thread, ownId);
      if (recipientId && (!profileId || recipientId === profileId)) {
        return {
          apiOrigin: thread.apiOrigin,
          conversationId: thread.conversationId,
          ownId,
          recipientId,
        };
      }
    }
    const origin = thread?.apiOrigin ?? apiOrigin ?? apiOriginFromPastRequests();
    if (!profileId || !origin) {
      return null;
    }
    let chat = lookedUp.get(profileId) ?? null;
    if (!chat) {
      chat = await lookupChat(origin, profileId);
      if (chat) {
        lookedUp.set(profileId, chat);
      }
    }
    return chat;
  };

  return {
    hideOne: async (messageId, profileId) => {
      const chat = await resolveChat(profileId);
      return chat ? hideOnePhoto(chat, messageId) : NO_CHAT_ERROR;
    },
    setAllHidden: async (profileId, isHidden) => {
      const chat = await resolveChat(profileId);
      return chat ? setAllPhotosHidden(chat, isHidden) : NO_CHAT_ERROR;
    },
  };
};
