import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoOverride } from "@sniffies-projects/core";

const dispatchHookMessage = (data: unknown, source: WindowProxy | null = window) => {
  window.dispatchEvent(new MessageEvent("message", { data, source }));
};

const flushPromises = () => new Promise<void>((r) => setTimeout(r, 0));

const LONDON: GeoOverride = {
  enabled: true,
  latitude: 51.489334,
  longitude: -0.144055,
  label: "London",
};

let messageListener: EventListenerOrEventListenerObject | undefined;

const removeMessageListener = (): void => {
  if (messageListener) {
    window.removeEventListener("message", messageListener);
    messageListener = undefined;
  }
};

describe("sniffies-geo-relay — initial load", () => {
  afterEach(removeMessageListener);

  it("posts the override read from storage on load", async () => {
    await chrome.storage.local.set({ geoOverride: LONDON });
    const addListenerSpy = vi.spyOn(window, "addEventListener");
    const postMessageSpy = vi.spyOn(window, "postMessage");

    vi.resetModules();
    await import("./sniffies-geo-relay.js");
    await flushPromises();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { source: "sniffies-geo-relay", kind: "override", override: LONDON },
      "*",
    );
    const registered = addListenerSpy.mock.calls.find(([type]) => type === "message");
    messageListener = registered?.[1] as EventListenerOrEventListenerObject | undefined;
    addListenerSpy.mockRestore();
    postMessageSpy.mockRestore();
  });
});

describe("sniffies-geo-relay", () => {
  let storageChangeListener:
    | ((changes: Record<string, { newValue?: unknown }>, area: string) => void)
    | undefined;
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const addListenerSpy = vi.spyOn(window, "addEventListener");
    postMessageSpy = vi.spyOn(window, "postMessage");
    vi.resetModules();
    await import("./sniffies-geo-relay.js");
    const registered = addListenerSpy.mock.calls.find(([type]) => type === "message");
    messageListener = registered?.[1] as EventListenerOrEventListenerObject | undefined;
    addListenerSpy.mockRestore();
    storageChangeListener = (chrome.storage.onChanged.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0];
    await flushPromises();
    postMessageSpy.mockClear();
  });

  afterEach(() => {
    removeMessageListener();
    storageChangeListener = undefined;
    postMessageSpy.mockRestore();
  });

  it("relays an external storage change (e.g. from the popup) to the MAIN world", () => {
    storageChangeListener?.({ geoOverride: { newValue: LONDON } }, "local");
    expect(postMessageSpy).toHaveBeenCalledWith(
      { source: "sniffies-geo-relay", kind: "override", override: LONDON },
      "*",
    );
  });

  it("ignores storage changes outside the local area", () => {
    storageChangeListener?.({ geoOverride: { newValue: LONDON } }, "sync");
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("ignores storage changes unrelated to geoOverride", () => {
    storageChangeListener?.({ someOtherKey: { newValue: "x" } }, "local");
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("persists an override captured in the MAIN world (persistOverride)", async () => {
    dispatchHookMessage({ source: "sniffies-geo-hook", kind: "persistOverride", override: LONDON });
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ geoOverride: LONDON });
  });

  it("does not persist for a position message", async () => {
    dispatchHookMessage({
      source: "sniffies-geo-hook",
      kind: "position",
      coords: { latitude: 1, longitude: 2 },
    });
    await flushPromises();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("ignores messages with the wrong source tag", async () => {
    dispatchHookMessage({ source: "some-other-script", kind: "persistOverride", override: LONDON });
    await flushPromises();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("ignores messages not sourced from the page's own window", async () => {
    dispatchHookMessage(
      { source: "sniffies-geo-hook", kind: "persistOverride", override: LONDON },
      null,
    );
    await flushPromises();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
