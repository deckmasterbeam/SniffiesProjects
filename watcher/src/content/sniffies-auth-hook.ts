// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Intercepts fetch and XHR calls to the post-authentication and isHuman endpoints and returns 200.

(() => {
  const TAG = "[sniffies-auth]";

  const isTargetUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url, location.href);
      return (
        parsed.host.endsWith(".sniffies.com") &&
        (parsed.pathname.includes("post-authentication") || parsed.pathname.includes("isHuman"))
      );
    } catch {
      return false;
    }
  };

  let enabled = false;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const msg = event.data as Record<string, unknown> | null;
    if (msg?.source === "sniffies-hook-settings") {
      enabled = !!(msg.settings as Record<string, unknown>)?.authHook;
    }
  });

  // --- fetch intercept ---

  type PatchedFetch = typeof fetch & { __sniffiesPatched?: boolean };

  const nativeFetch = window.fetch as PatchedFetch;
  if (nativeFetch && !nativeFetch.__sniffiesPatched) {
    const patchedFetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (enabled && isTargetUrl(url)) {
        console.log(TAG, "fetch intercepted, returning 200");
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return nativeFetch(input, init);
    } as PatchedFetch;

    patchedFetch.__sniffiesPatched = true;
    window.fetch = patchedFetch;
    console.log(TAG, "fetch hook installed");
  }

  // --- XHR intercept ---
  // Captcha hook replaced window.XMLHttpRequest with a subclass. We extend that
  // subclass so super.open/send chain through the full prototype hierarchy rather
  // than bypassing our patch via bound super references.

  const BaseXHR = window.XMLHttpRequest;

  class AuthInterceptXHR extends BaseXHR {
    private _authIntercept = false;

    open(
      method: string,
      url: string | URL,
      async = true,
      user?: string,
      password?: string,
    ): void {
      const urlStr = typeof url === "string" ? url : url.href;
      this._authIntercept = enabled && isTargetUrl(urlStr);
      super.open(method, url as string, async, user, password);
    }

    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (this._authIntercept) {
        console.log(TAG, "XHR intercepted, returning 200");
        Object.defineProperties(this, {
          status: { get: () => 200, configurable: true },
          statusText: { get: () => "OK", configurable: true },
          responseText: { get: () => "{}", configurable: true },
          response: { get: () => "{}", configurable: true },
          readyState: { get: () => XMLHttpRequest.DONE, configurable: true },
        });
        setTimeout(() => {
          this.dispatchEvent(new Event("readystatechange"));
          this.dispatchEvent(new ProgressEvent("load"));
          this.dispatchEvent(new ProgressEvent("loadend"));
        }, 0);
        return;
      }
      super.send(body);
    }
  }

  window.XMLHttpRequest = AuthInterceptXHR as unknown as typeof XMLHttpRequest;
  console.log(TAG, "XHR hook installed");
})();
