import { createLogger } from "./log.js";
import {
  MESSAGES_PATH,
  PHOTO_VISIBILITY_PATH,
  isSniffiesApiHost,
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

const findRecipient = (thread: ThreadSnapshot, ownId: string): string | undefined =>
  thread.messages.find((m) => m.author && m.author !== ownId)?.author ??
  thread.partialUserIds.find((id) => id !== ownId);

const postPhotoVisibility = async (
  thread: ThreadSnapshot,
  ownId: string,
  recipient: string,
  messageId: string,
  doFetch: typeof fetch,
): Promise<string | null> => {
  const body: PhotoVisibilityBody = {
    conversationId: thread.conversationId,
    conversationLocation: null,
    userIdFrom: ownId,
    userIdTo: recipient,
    messageId,
    isHidden: true,
    file: null,
  };
  try {
    const res = await doFetch(`${thread.apiOrigin}${PHOTO_VISIBILITY_PATH}`, {
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

/** Hides one photo message by id. Resolves to an error message, or null on success. */
export const hideOnePhoto = async (
  thread: ThreadSnapshot,
  ownId: string,
  messageId: string,
  doFetch: typeof fetch = window.fetch.bind(window),
): Promise<string | null> => {
  const recipient = findRecipient(thread, ownId);
  if (!recipient) {
    return "Couldn't tell who this chat is with.";
  }
  const error = await postPhotoVisibility(thread, ownId, recipient, messageId, doFetch);
  if (!error) {
    const message = thread.messages.find((m) => m._id === messageId);
    if (message) {
      message.isHidden = true;
    }
  }
  return error;
};

export interface SentPhotoHider {
  /** Hides one sent photo in the open chat; null on success, else why not. */
  hideOne: (messageId: string) => Promise<string | null>;
}

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & {
  __sniffiesSentPhotosPatched?: boolean;
};
type XhrWithUrl = XMLHttpRequest & { __sniffiesMessagesUrl?: URL | null };

const parseMessagesUrl = (url: string): URL | null => {
  try {
    const parsed = new URL(url, location.href);
    return isSniffiesApiHost(parsed.host) && parsed.pathname === MESSAGES_PATH ? parsed : null;
  } catch {
    return null;
  }
};

/** Remembers the last loaded chat thread so a photo in it can be hidden by id. */
export const installSentPhotoHider = (getOwnUserId: () => string): SentPhotoHider => {
  let thread: ThreadSnapshot | null = null;

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
      this.__sniffiesMessagesUrl = parseMessagesUrl(url.toString());
      return (nativeOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
    } as typeof proto.open;

    proto.send = function (this: XhrWithUrl, ...args: unknown[]) {
      const url = this.__sniffiesMessagesUrl;
      const conversationId = url?.searchParams.get("conversationId");
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

  return {
    hideOne: async (messageId) => {
      const ownId = getOwnUserId();
      if (!thread || !ownId) {
        return "Open a chat first.";
      }
      return hideOnePhoto(thread, ownId, messageId);
    },
  };
};
