import { AUTHENTICATE_CURRENT_PATH, type AuthenticateCurrentPayload } from "./sniffies-api.js";

/** True when the account has an active Sniffies Plus membership that hasn't ended. */
export const isPlusMembership = (body: AuthenticateCurrentPayload, now = Date.now()): boolean => {
  const membership = body.user?.private?.appstoreMembership;
  if (!membership || membership.subscriptionStatus !== "active") {
    return false;
  }
  return membership.end === undefined || Date.parse(membership.end) > now;
};

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & { __sniffiesPlusPatched?: boolean };
type XhrWithPlusFlag = XMLHttpRequest & { __sniffiesIsAuthCurrent?: boolean };

const report = (text: string, onResult: (hasPlus: boolean) => void): void => {
  try {
    onResult(isPlusMembership(JSON.parse(text) as AuthenticateCurrentPayload));
  } catch {
    // Unparseable response: report nothing rather than guess.
  }
};

/**
 * Watches the POST /api/authenticate/current response (fetch and XHR) and reports whether the
 * account has Sniffies Plus.
 */
export const installPlusHook = (onResult: (hasPlus: boolean) => void): void => {
  const proto = XMLHttpRequest.prototype as PatchedXHRPrototype;
  if (proto.__sniffiesPlusPatched) {
    return;
  }
  proto.__sniffiesPlusPatched = true;

  const nativeOpen = proto.open;
  const nativeSend = proto.send;
  proto.open = function (
    this: XhrWithPlusFlag,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__sniffiesIsAuthCurrent = url.toString().includes(AUTHENTICATE_CURRENT_PATH);
    return (nativeOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
  } as typeof proto.open;
  proto.send = function (this: XhrWithPlusFlag, ...args: unknown[]) {
    if (this.__sniffiesIsAuthCurrent) {
      this.addEventListener("load", () => report(this.responseText, onResult));
    }
    return (nativeSend as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof proto.send;

  const nativeFetch = window.fetch;
  window.fetch = async (input, init) => {
    const response = await nativeFetch.call(window, input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(AUTHENTICATE_CURRENT_PATH)) {
      void response
        .clone()
        .text()
        .then((text) => report(text, onResult))
        .catch(() => {});
    }
    return response;
  };
};
