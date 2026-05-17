// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Wraps fetch and XMLHttpRequest to intercept the captcha verify response and
// always return success, regardless of whether the puzzle was actually solved correctly.

(() => {
  const TAG = "[captcha-hook]";
  const VERIFY_PATH = "/api/sniffies-captcha/verify";

  let enabled = false;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const msg = event.data as Record<string, unknown> | null;
    if (msg?.source === "sniffies-hook-settings") {
      enabled = !!(msg.settings as Record<string, unknown>)?.captchaHook;
    }
  });

  // --- fetch hook ---
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (enabled && url.includes(VERIFY_PATH)) {
      const realResponse = await nativeFetch(input, init);
      const realBody = await realResponse.clone().json().catch(() => null);
      console.log(TAG, "[fetch] real verify response:", realBody);

      return new Response(JSON.stringify({ message: "Validated as human." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return nativeFetch(input, init);
  };

  // --- XMLHttpRequest hook ---
  const NativeXHR = window.XMLHttpRequest;

  class PatchedXHR extends NativeXHR {
    private _intercepting = false;
    private _method = "GET";
    private _url = "";
    private _async = true;

    open(method: string, url: string | URL, async?: boolean, user?: string, password?: string): void {
      this._method = method;
      this._url = url instanceof URL ? url.href : url;
      this._async = async ?? true;
      if (enabled && this._url.includes(VERIFY_PATH)) {
        this._intercepting = true;
      }
      super.open(method, url as string, this._async, user, password);
    }

    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (!this._intercepting) {
        super.send(body);
        return;
      }

      const real = new NativeXHR();
      real.open(this._method, this._url, this._async);
      real.onloadend = () => {
        console.log(TAG, "[xhr] real verify response:", real.responseText);

        const fakeBody = JSON.stringify({ message: "Validated as human." });
        Object.defineProperty(this, "readyState", { value: 4, configurable: true });
        Object.defineProperty(this, "status", { value: 200, configurable: true });
        Object.defineProperty(this, "responseText", { value: fakeBody, configurable: true });
        Object.defineProperty(this, "response", { value: fakeBody, configurable: true });
        this.dispatchEvent(new ProgressEvent("load"));
        this.dispatchEvent(new ProgressEvent("loadend"));
      };
      real.send(body as XMLHttpRequestBodyInit);
    }
  }

  window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;

  console.log(TAG, "fetch + XHR hooks installed (enabled at runtime via settings)");
})();
