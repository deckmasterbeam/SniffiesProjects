import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installOwnIdHook } from "./own-id-hook.js";

const API = "https://uswapi.sniffies.com";
const { open, send } = XMLHttpRequest.prototype;

describe("installOwnIdHook", () => {
  const nativeFetch = vi.fn();
  const onUserId = vi.fn();

  beforeEach(() => {
    XMLHttpRequest.prototype.open = open;
    XMLHttpRequest.prototype.send = send;
    delete (XMLHttpRequest.prototype as { __sniffiesOwnIdPatched?: boolean })
      .__sniffiesOwnIdPatched;
    nativeFetch
      .mockReset()
      .mockResolvedValue(new Response(JSON.stringify({ user: { _id: "me" } })));
    onUserId.mockReset();
    window.fetch = nativeFetch;
    installOwnIdHook(onUserId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads userIdFrom from a Sniffies API request body", async () => {
    await window.fetch(`${API}/api/messages/photo-visibility`, {
      method: "POST",
      body: JSON.stringify({ userIdFrom: "me", userIdTo: "them" }),
    });
    expect(onUserId).toHaveBeenCalledExactlyOnceWith("me");
  });

  it("reads user._id from the authenticate/current response", async () => {
    await window.fetch(`${API}/api/authenticate/current`, { method: "POST", body: "{}" });
    await vi.waitFor(() => expect(onUserId).toHaveBeenCalledExactlyOnceWith("me"));
  });

  it("ignores other hosts and bodies without userIdFrom", async () => {
    await window.fetch("https://example.com/api/x", { method: "POST", body: '{"userIdFrom":"x"}' });
    await window.fetch(`${API}/api/x`, { method: "POST", body: '{"userIdTo":"them"}' });
    await window.fetch(`${API}/api/x`, { method: "POST", body: "not json" });
    expect(onUserId).not.toHaveBeenCalled();
  });

  it("reads userIdFrom from an XHR request body, as Sniffies' own app sends it", () => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/messages/photo-visibility`);
    try {
      xhr.send(JSON.stringify({ userIdFrom: "me", userIdTo: "them" }));
    } catch {
      // jsdom can't reach the network; the hook has already seen the body by now
    }
    expect(onUserId).toHaveBeenCalledExactlyOnceWith("me");
  });
});
