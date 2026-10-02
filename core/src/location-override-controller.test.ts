import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installLocationOverrideController } from "./location-override-controller.js";
import type { GeoOverride } from "./settings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISABLED: GeoOverride = { enabled: false, latitude: 0, longitude: 0 };
const ENABLED_WITH_COORDS: GeoOverride = { enabled: true, latitude: 47.6, longitude: -122.3 };

const REAL_POSITION = {
  coords: {
    latitude: 51.5,
    longitude: -0.1,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
} as GeolocationPosition;

const makeMockGeo = () => ({
  getCurrentPosition: vi.fn((success: PositionCallback) => success(REAL_POSITION)),
  watchPosition: vi.fn(() => 1),
  clearWatch: vi.fn(),
});

const makeMockXHRCtor = (): typeof XMLHttpRequest => {
  class MockXMLHttpRequest extends EventTarget {
    static __sniffiesCitySearchPatched?: boolean;
    responseText = "";
    open(_method: string, _url: string): void {}
    send(): void {}
    __respond(text: string): void {
      this.responseText = text;
      this.dispatchEvent(new Event("load"));
    }
  }
  return MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
};

const LONDON_BODY = JSON.stringify({
  location: { coordinates: [-0.144055, 51.489334] },
  city: "London",
  admin_name: "England",
});

const click = (el: Element) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const searchForLondon = (): void => {
  const xhr = new window.XMLHttpRequest() as XMLHttpRequest & { __respond: (t: string) => void };
  xhr.open("GET", "https://usw.api.sniffies.com/api/city/R65606");
  xhr.send();
  xhr.__respond(LONDON_BODY);
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let travelButton: HTMLButtonElement;
let citiesInputRoot: HTMLElement;
let clickListener: EventListenerOrEventListenerObject | undefined;
let nativeFetchMock: ReturnType<typeof vi.fn>;
let originalXHR: typeof XMLHttpRequest;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "geolocation", { value: makeMockGeo(), configurable: true });

  originalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = makeMockXHRCtor();

  nativeFetchMock = vi.fn().mockResolvedValue({});
  vi.stubGlobal("fetch", nativeFetchMock);

  travelButton = document.createElement("button");
  travelButton.setAttribute("data-testid", "travelHereButton");
  document.body.appendChild(travelButton);

  citiesInputRoot = document.createElement("cities-input");
  citiesInputRoot.innerHTML =
    '<div class="cities-input-container"><input data-testid="citiesInput" /></div>';
  document.body.appendChild(citiesInputRoot);
});

afterEach(() => {
  document.body.removeChild(travelButton);
  document.body.removeChild(citiesInputRoot);
  document.getElementById("snp-city-search-status")?.remove();
  window.XMLHttpRequest = originalXHR;
  vi.unstubAllGlobals();
  if (clickListener) {
    document.removeEventListener("click", clickListener, true);
    clickListener = undefined;
  }
  vi.useRealTimers();
});

const install = (initialOverride: GeoOverride = DISABLED) => {
  const addEventListenerSpy = vi.spyOn(document, "addEventListener");
  const reloadPage = vi.fn();
  const onOverrideChanged = vi.fn();
  const controller = installLocationOverrideController({
    initialOverride,
    onOverrideChanged,
    reloadPage,
  });
  const registered = addEventListenerSpy.mock.calls.find(([type]) => type === "click");
  clickListener = registered?.[1] as EventListenerOrEventListenerObject | undefined;
  addEventListenerSpy.mockRestore();
  return { controller, reloadPage, onOverrideChanged };
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("installLocationOverrideController", () => {
  describe("getOverride / setOverride / syncOverride", () => {
    it("getOverride reflects the initial override", () => {
      const { controller } = install(ENABLED_WITH_COORDS);
      expect(controller.getOverride()).toEqual(ENABLED_WITH_COORDS);
    });

    it("setOverride updates state, persists via onOverrideChanged, and notifies subscribers", () => {
      const { controller, onOverrideChanged } = install(DISABLED);
      const onChange = vi.fn();
      controller.subscribeChange(onChange);
      controller.setOverride(ENABLED_WITH_COORDS);
      expect(controller.getOverride()).toEqual(ENABLED_WITH_COORDS);
      expect(onOverrideChanged).toHaveBeenCalledWith(ENABLED_WITH_COORDS);
      expect(onChange).toHaveBeenCalledWith(ENABLED_WITH_COORDS);
    });

    it("syncOverride updates state and notifies subscribers WITHOUT calling onOverrideChanged", () => {
      const { controller, onOverrideChanged } = install(DISABLED);
      const onChange = vi.fn();
      controller.subscribeChange(onChange);
      controller.syncOverride(ENABLED_WITH_COORDS);
      expect(controller.getOverride()).toEqual(ENABLED_WITH_COORDS);
      expect(onChange).toHaveBeenCalledWith(ENABLED_WITH_COORDS);
      expect(onOverrideChanged).not.toHaveBeenCalled();
    });
  });

  describe("geo-hook wiring", () => {
    it("spoofs navigator.geolocation once enabled with captured coords", () => {
      const { controller } = install(DISABLED);
      controller.setOverride(ENABLED_WITH_COORDS);
      const success = vi.fn();
      navigator.geolocation.getCurrentPosition(success);
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({
          coords: expect.objectContaining({ latitude: 47.6, longitude: -122.3 }),
        }),
      );
    });

    it("passes through real coords while disabled", () => {
      install(DISABLED);
      const success = vi.fn();
      navigator.geolocation.getCurrentPosition(success);
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({
          coords: expect.objectContaining({ latitude: 51.5, longitude: -0.1 }),
        }),
      );
    });
  });

  describe("city search capture", () => {
    it("stages a pending location instead of persisting it immediately when enabled", () => {
      const { controller, onOverrideChanged } = install({
        ...ENABLED_WITH_COORDS,
        latitude: 0,
        longitude: 0,
      });
      searchForLondon();
      expect(controller.getOverride().latitude).toBe(0); // unchanged — still pending, not applied
      expect(onOverrideChanged).not.toHaveBeenCalled();
    });

    it("shows a pending status message next to the search box", () => {
      install({ enabled: true, latitude: 0, longitude: 0 });
      searchForLondon();
      const el = document.getElementById("snp-city-search-status");
      expect(el?.textContent).toContain("London, England");
      expect(el?.textContent).toContain("pending");
    });

    it("ignores the search result entirely while spoofing is disabled", () => {
      install(DISABLED);
      searchForLondon();
      const el = document.getElementById("snp-city-search-status");
      expect(el?.textContent).not.toContain("London");
    });
  });

  describe("confirming via Travel here", () => {
    it("commits a pending search location, persists it, pushes to Sniffies, and reloads", async () => {
      const { controller, onOverrideChanged, reloadPage } = install({
        enabled: true,
        latitude: 0,
        longitude: 0,
      });
      // Establishes apiBase, same as the automatic PUT Sniffies sends on page
      // load in practice — without it, sendLocationUpdate has nothing to
      // replay or fall back to proactively PUTting against.
      await window.fetch("https://usw.api.sniffies.com/api/visitor/current/location", {
        method: "PUT",
        body: "{}",
      });
      nativeFetchMock.mockClear();
      searchForLondon();

      click(travelButton);
      expect(controller.getOverride()).toEqual(
        expect.objectContaining({
          latitude: 51.489334,
          longitude: -0.144055,
          label: "London, England",
        }),
      );
      expect(onOverrideChanged).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 51.489334, longitude: -0.144055 }),
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(nativeFetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/visitor/current/location"),
        expect.objectContaining({ method: "PUT" }),
      );
      expect(reloadPage).toHaveBeenCalled();
    });

    it("clears the pending status message once confirmed", () => {
      install({ enabled: true, latitude: 0, longitude: 0 });
      searchForLondon();
      click(travelButton);
      const el = document.getElementById("snp-city-search-status");
      expect(el?.textContent).not.toContain("pending");
    });

    it("reloads even if the proactive push hangs, after the safety timeout", async () => {
      nativeFetchMock.mockReturnValue(new Promise(() => {})); // never resolves
      const { reloadPage } = install({ enabled: true, latitude: 0, longitude: 0 });
      searchForLondon();
      click(travelButton);

      expect(reloadPage).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(4001);
      expect(reloadPage).toHaveBeenCalled();
    });

    it("does nothing when there is no pending search location", () => {
      const { onOverrideChanged, reloadPage } = install(DISABLED);
      click(travelButton);
      expect(onOverrideChanged).not.toHaveBeenCalled();
      expect(reloadPage).not.toHaveBeenCalled();
    });
  });

  describe("travel-here PUT capture (fetch)", () => {
    const putLocation = (body: unknown) =>
      window.fetch("https://usw.api.sniffies.com/api/visitor/current/location", {
        method: "PUT",
        body: JSON.stringify(body),
      });

    it("captures the destination from an armed PUT when spoofing is enabled", async () => {
      const { controller, onOverrideChanged } = install({
        enabled: true,
        latitude: 0,
        longitude: 0,
      });
      click(travelButton); // arms
      await putLocation({ virtualLocation: { lat: 47.6, lng: -122.3 } });
      expect(controller.getOverride()).toEqual(
        expect.objectContaining({ enabled: true, latitude: 47.6, longitude: -122.3 }),
      );
      expect(onOverrideChanged).toHaveBeenCalled();
    });

    it("does not capture an armed PUT while spoofing is disabled", async () => {
      const { controller } = install(DISABLED);
      click(travelButton);
      await putLocation({ virtualLocation: { lat: 47.6, lng: -122.3 } });
      expect(controller.getOverride()).toEqual(DISABLED);
    });

    it("does not capture an unarmed PUT (no preceding Travel-here click)", async () => {
      const { controller } = install({ enabled: true, latitude: 0, longitude: 0 });
      await putLocation({ virtualLocation: { lat: 47.6, lng: -122.3 } });
      expect(controller.getOverride().latitude).toBe(0);
    });

    it("rewrites an unrelated location PUT's body to keep it consistent with an already-enabled override", async () => {
      install(ENABLED_WITH_COORDS);
      await putLocation({
        virtualLocation: { lat: 1, lng: 2 },
        physicalLocation: { lat: 1, lng: 2 },
      });
      const sentBody = JSON.parse(nativeFetchMock.mock.calls[0]![1].body as string) as {
        virtualLocation: { lat: number; lng: number };
      };
      expect(sentBody.virtualLocation).toEqual({ lat: 47.6, lng: -122.3 });
    });

    it("leaves an unrelated location PUT's body alone when disabled", async () => {
      install(DISABLED);
      await putLocation({ virtualLocation: { lat: 1, lng: 2 } });
      const sentBody = JSON.parse(nativeFetchMock.mock.calls[0]![1].body as string) as {
        virtualLocation: { lat: number; lng: number };
      };
      expect(sentBody.virtualLocation).toEqual({ lat: 1, lng: 2 });
    });
  });
});
