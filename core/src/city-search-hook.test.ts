import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractCitySearchResult,
  installCitySearchXhrObserver,
  isCitySearchUrl,
} from "./city-search-hook.js";

describe("isCitySearchUrl", () => {
  it("matches the city endpoint on either regional API host", () => {
    expect(isCitySearchUrl("https://uswapi.sniffies.com/api/city/R65606")).toBe(true);
    expect(isCitySearchUrl("https://uswapi2.sniffies.com/api/city/R65606")).toBe(true);
  });

  it("does not match unrelated endpoints", () => {
    expect(isCitySearchUrl("https://uswapi.sniffies.com/api/visitor/current/location")).toBe(false);
    expect(isCitySearchUrl("https://uswapi.sniffies.com/api/cities?q=lon")).toBe(false);
  });
});

describe("extractCitySearchResult", () => {
  const LONDON_RESPONSE = {
    _id: "R65606",
    location: { type: "Point", coordinates: [-0.144055, 51.489334] },
    city: "London",
    admin_name: "England",
    countryCode: "GB",
  };

  it("extracts lat/lng (GeoJSON [lng, lat] order) and a combined label", () => {
    expect(extractCitySearchResult(LONDON_RESPONSE)).toEqual({
      latitude: 51.489334,
      longitude: -0.144055,
      label: "London, England",
    });
  });

  it("falls back to just the city when admin_name is missing", () => {
    const { admin_name: _adminName, ...rest } = LONDON_RESPONSE;
    expect(extractCitySearchResult(rest)?.label).toBe("London");
  });

  it("omits the label entirely when neither city nor admin_name is present", () => {
    const { city: _city, admin_name: _adminName, ...rest } = LONDON_RESPONSE;
    expect(extractCitySearchResult(rest)?.label).toBeUndefined();
  });

  it("returns null when coordinates are missing", () => {
    expect(extractCitySearchResult({ city: "London" })).toBeNull();
  });

  it("returns null for non-numeric coordinates", () => {
    expect(
      extractCitySearchResult({ location: { coordinates: ["a", "b"] }, city: "London" }),
    ).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractCitySearchResult(null)).toBeNull();
    expect(extractCitySearchResult(undefined)).toBeNull();
    expect(extractCitySearchResult("string")).toBeNull();
  });
});

// ── installCitySearchXhrObserver ────────────────────────────────────────────

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

describe("installCitySearchXhrObserver", () => {
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = makeMockXHRCtor();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  const LONDON_BODY = JSON.stringify({
    location: { coordinates: [-0.144055, 51.489334] },
    city: "London",
    admin_name: "England",
  });

  it("reports the extracted result when a city endpoint XHR loads", () => {
    const onResponse = vi.fn();
    installCitySearchXhrObserver(onResponse);

    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & { __respond: (t: string) => void };
    xhr.open("GET", "https://usw.api.sniffies.com/api/city/R65606");
    xhr.send();
    xhr.__respond(LONDON_BODY);

    expect(onResponse).toHaveBeenCalledWith({
      latitude: 51.489334,
      longitude: -0.144055,
      label: "London, England",
    });
  });

  it("does not report anything for unrelated XHR requests", () => {
    const onResponse = vi.fn();
    installCitySearchXhrObserver(onResponse);

    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & { __respond: (t: string) => void };
    xhr.open("GET", "https://usw.api.sniffies.com/api/visitor/current/location");
    xhr.send();
    xhr.__respond(LONDON_BODY);

    expect(onResponse).not.toHaveBeenCalled();
  });

  it("reports null when the response body doesn't parse as JSON", () => {
    const onResponse = vi.fn();
    installCitySearchXhrObserver(onResponse);

    const xhr = new window.XMLHttpRequest() as XMLHttpRequest & { __respond: (t: string) => void };
    xhr.open("GET", "https://usw.api.sniffies.com/api/city/R65606");
    xhr.send();
    xhr.__respond("not json");

    expect(onResponse).toHaveBeenCalledWith(null);
  });

  it("only patches XMLHttpRequest.prototype once", () => {
    const onResponse = vi.fn();
    installCitySearchXhrObserver(onResponse);
    const patchedOpen = window.XMLHttpRequest.prototype.open;
    installCitySearchXhrObserver(vi.fn());
    expect(window.XMLHttpRequest.prototype.open).toBe(patchedOpen);
  });
});
