import { createLogger } from "./log.js";
import { MESSAGES_PATH, isSniffiesApiHost, type MessagesPayload } from "./sniffies-api.js";
import { CHAT_MESSAGE_CONTAINER_SELECTOR, READ_MARKER_SELECTOR } from "./sniffies-selectors.js";
import { STRINGS } from "./strings.js";

const log = createLogger("read-receipt");

const OWN_MARKER_ATTR = "data-sniffies-read-marker";

export const findSeenMessageId = (payload: MessagesPayload): string | null => {
  const [[readerId, lastRead] = []] = Object.entries(payload.lastReadMessageIds ?? {});
  if (!readerId || !lastRead) {
    return null;
  }
  const sent = (payload.messages ?? []).find(
    (m) => m.author !== readerId && m._id && m._id <= lastRead,
  );
  return sent?._id ?? null;
};

const copyScope = (from: Element, to: Element): void => {
  for (const { name } of from.attributes) {
    if (name.startsWith("_ngcontent-")) {
      to.setAttribute(name, "");
    }
  }
};

const buildMarker = (container: Element): HTMLElement => {
  const marker = document.createElement("div");
  marker.className = "read-marker";
  marker.setAttribute(OWN_MARKER_ATTR, "");
  copyScope(container, marker);
  const icon = document.createElement("i");
  icon.className = "fa fa-check-circle static";
  copyScope(container, icon);
  marker.append(icon, ` ${STRINGS.readReceipt.seen} `);
  return marker;
};

const render = (seenId: string | null, enabled: boolean): void => {
  // Drop our marker from anywhere but the current target (e.g. after switching chats).
  const target =
    enabled && seenId
      ? document.getElementById(`message-${seenId}`)?.closest(CHAT_MESSAGE_CONTAINER_SELECTOR)
      : null;
  for (const own of document.querySelectorAll(`[${OWN_MARKER_ATTR}]`)) {
    if (own.parentElement !== target) {
      own.parentElement?.classList.remove("read");
      own.remove();
    }
  }
  // Paid accounts already get Sniffies' own marker; don't double up.
  if (target && !target.querySelector(READ_MARKER_SELECTOR)) {
    target.classList.add("read");
    target.append(buildMarker(target));
    log("added Seen marker to", seenId);
  }
};

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & {
  __sniffiesReadReceiptPatched?: boolean;
};
type XhrWithUrl = XMLHttpRequest & { __sniffiesMessagesUrl?: URL | null };

export const installReadReceipt = (isEnabled: () => boolean): void => {
  const proto = XMLHttpRequest.prototype as PatchedXHRPrototype;
  if (proto.__sniffiesReadReceiptPatched) {
    return;
  }
  proto.__sniffiesReadReceiptPatched = true;

  let seenId: string | null = null;
  const nativeOpen = proto.open;
  const nativeSend = proto.send;

  proto.open = function (this: XhrWithUrl, method: string, url: string | URL, ...rest: unknown[]) {
    try {
      const parsed = new URL(url.toString(), location.href);
      this.__sniffiesMessagesUrl =
        isSniffiesApiHost(parsed.host) &&
        parsed.pathname === MESSAGES_PATH &&
        parsed.searchParams.has("conversationId")
          ? parsed
          : null;
    } catch {
      this.__sniffiesMessagesUrl = null;
    }
    return (nativeOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
  } as typeof proto.open;

  proto.send = function (this: XhrWithUrl, ...args: unknown[]) {
    if (this.__sniffiesMessagesUrl) {
      this.addEventListener("load", () => {
        try {
          const payload = (
            this.responseType === "json" ? this.response : JSON.parse(this.responseText)
          ) as MessagesPayload;
          seenId = findSeenMessageId(payload);
          render(seenId, isEnabled());
        } catch {
          // not a thread we can read; keep the previous marker
        }
      });
    }
    return (nativeSend as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof proto.send;

  const observer = new MutationObserver(() => render(seenId, isEnabled()));
  const start = (): void => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
};
