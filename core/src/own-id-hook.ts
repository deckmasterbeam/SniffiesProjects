import { createLogger } from "./log.js";
import {
  AUTHENTICATE_CURRENT_PATH,
  isSniffiesApiHost,
  type AuthenticateCurrentPayload,
} from "./sniffies-api.js";

const log = createLogger("own-id");

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & { __sniffiesOwnIdPatched?: boolean };
type XhrWithUrl = XMLHttpRequest & { __sniffiesOwnIdUrl?: URL | null };

const parseApiUrl = (url: string): URL | null => {
  try {
    const parsed = new URL(url, location.href);
    return isSniffiesApiHost(parsed.host) && parsed.pathname.startsWith("/api/") ? parsed : null;
  } catch {
    return null;
  }
};

/** `userIdFrom` is the sender of the request, i.e. the account itself. */
const idFromRequestBody = (body: unknown): string | null => {
  if (typeof body !== "string") {
    return null;
  }
  try {
    const { userIdFrom } = JSON.parse(body) as { userIdFrom?: unknown };
    return typeof userIdFrom === "string" && userIdFrom ? userIdFrom : null;
  } catch {
    return null;
  }
};

const idFromAuthResponse = (text: string): string | null => {
  try {
    const id = (JSON.parse(text) as AuthenticateCurrentPayload).user?._id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
};

/**
 * Watches Sniffies API traffic (fetch and XHR) for the account's own id: a `userIdFrom` in a
 * request body, or `user._id` in the POST /api/authenticate/current response.
 */
export const installOwnIdHook = (onUserId: (userId: string) => void): void => {
  const report = (id: string | null, source: string): void => {
    if (id) {
      log("observed own id from", source);
      onUserId(id);
    }
  };

  const proto = XMLHttpRequest.prototype as PatchedXHRPrototype;
  if (proto.__sniffiesOwnIdPatched) {
    return;
  }
  proto.__sniffiesOwnIdPatched = true;

  const nativeOpen = proto.open;
  const nativeSend = proto.send;
  proto.open = function (this: XhrWithUrl, method: string, url: string | URL, ...rest: unknown[]) {
    this.__sniffiesOwnIdUrl = parseApiUrl(url.toString());
    return (nativeOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
  } as typeof proto.open;
  proto.send = function (this: XhrWithUrl, ...args: unknown[]) {
    const url = this.__sniffiesOwnIdUrl;
    if (url) {
      report(idFromRequestBody(args[0]), "xhr request");
      if (url.pathname.includes(AUTHENTICATE_CURRENT_PATH)) {
        this.addEventListener("load", () =>
          report(idFromAuthResponse(this.responseText), "xhr auth response"),
        );
      }
    }
    return (nativeSend as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof proto.send;

  const nativeFetch = window.fetch;
  window.fetch = async (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = parseApiUrl(href);
    if (url) {
      report(idFromRequestBody(init?.body), "fetch request");
    }
    const response = await nativeFetch.call(window, input, init);
    if (url?.pathname.includes(AUTHENTICATE_CURRENT_PATH)) {
      void response
        .clone()
        .text()
        .then((text) => report(idFromAuthResponse(text), "fetch auth response"))
        .catch(() => {});
    }
    return response;
  };
};
