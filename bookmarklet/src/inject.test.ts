import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sniffies-projects/core", () => ({
  installGeoHook: () => null,
  DEFAULT_GEO_OVERRIDE: { enabled: false, latitude: 0, longitude: 0 },
  GEO_OVERRIDE_HTML: "<div></div>",
  GEO_OVERRIDE_CSS: "",
  wireGeoOverrideForm: vi.fn(),
  createLogger: () => Object.assign(() => {}, { warn: () => {}, error: () => {} }),
}));

vi.mock("./mount-fab.js", () => ({
  mountFab: vi.fn((fab: HTMLButtonElement, onMounted: () => void) => {
    document.body.appendChild(fab);
    onMounted();
  }),
  isSniffiesDomain: () => true,
}));

// This module attaches to `document` (and, once injected, `window.fetch`) as a
// side effect of import — reset per test like the other content-script tests.
let domContentLoadedListener: EventListenerOrEventListenerObject | undefined;

const loadModule = async () => {
  vi.resetModules();
  delete (window as unknown as Record<string, unknown>).__sniffiesInjected;
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition: vi.fn(), watchPosition: vi.fn(), clearWatch: vi.fn() },
    configurable: true,
  });
  const addListenerSpy = vi.spyOn(document, "addEventListener");
  await import("./inject.js");
  const registered = addListenerSpy.mock.calls.find(([type]) => type === "DOMContentLoaded");
  domContentLoadedListener = registered?.[1] as EventListenerOrEventListenerObject | undefined;
  addListenerSpy.mockRestore();
};

const setReadyState = (value: DocumentReadyState): void => {
  Object.defineProperty(document, "readyState", { value, configurable: true });
};

describe("inject entry point", () => {
  let alertMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);
  });

  afterEach(() => {
    if (domContentLoadedListener) {
      document.removeEventListener("DOMContentLoaded", domContentLoadedListener);
      domContentLoadedListener = undefined;
    }
    vi.unstubAllGlobals();
    setReadyState("complete");
    if (!document.body) {
      document.documentElement.appendChild(document.createElement("body"));
    }
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("does not throw when document.body doesn't exist yet (e.g. Tampermonkey's document-start)", async () => {
    setReadyState("loading");
    document.body.remove();
    expect(document.body).toBeNull();

    await expect(loadModule()).resolves.not.toThrow();
    // UI mounting is deferred — nothing should have touched the DOM yet.
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("mounts the UI once DOMContentLoaded fires, if it was deferred", async () => {
    setReadyState("loading");
    document.body.remove();
    await loadModule();

    // <body> shows up mid-parse, before DOMContentLoaded fires.
    document.documentElement.appendChild(document.createElement("body"));

    expect(domContentLoadedListener).toBeDefined();
    (domContentLoadedListener as EventListener)(new Event("DOMContentLoaded"));

    expect(alertMock).toHaveBeenCalled();
    expect(document.getElementById("snp-panel")).not.toBeNull();
  });

  it("mounts the UI immediately when the document is already ready", async () => {
    setReadyState("complete");
    await loadModule();

    expect(alertMock).toHaveBeenCalled();
    expect(document.getElementById("snp-panel")).not.toBeNull();
  });
});
