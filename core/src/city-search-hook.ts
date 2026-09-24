// Lets the extension pick up the location behind Sniffies' Travel Mode city
// search box (`cities-input`) — a fallback for when the "Travel here" map-pin
// flow can't be captured (e.g. no PUT ever fires for paywalled accounts).
// GET /api/city/{id} runs when a search result is selected and returns the
// picked city's coordinates directly in its response body, so unlike the
// travel-here capture (which reads an outgoing request body) this reads an
// incoming response body.
//
// Confirmed via DevTools' Network panel Initiator stack: this call
// (getFullCityData/selectCity) goes through XMLHttpRequest, not fetch —
// unlike the travel-here location PUT, which does use fetch. Angular's
// HttpClient backend is a single global choice, but Sniffies isn't
// consistent about which transport different parts of its own app use (the
// existing XHR patch in bot-block-hook.ts exists for the same reason), so
// this has to patch XHR independently rather than reusing the fetch hook.

// Matches uswapi(2).sniffies.com/api/city/<id> — deliberately not anchored to
// a specific host, since Sniffies serves from multiple regional API hosts.
const CITY_ENDPOINT_PATTERN = /\/api\/city\/[^/?]+/;

export const isCitySearchUrl = (url: string): boolean => CITY_ENDPOINT_PATTERN.test(url);

export interface CitySearchResult {
  latitude: number;
  longitude: number;
  /** e.g. "London, England" — omitted if the response had no city/admin_name to build one from. */
  label?: string;
}

/** Extracts coordinates + a display label from a GET /api/city/{id} response body, if present. */
export const extractCitySearchResult = (body: unknown): CitySearchResult | null => {
  if (!body || typeof body !== "object") {
    return null;
  }
  const b = body as Record<string, unknown>;
  const location = b.location as { coordinates?: unknown } | undefined;
  const coords = location?.coordinates;
  if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") {
    return null;
  }
  // GeoJSON Point order is [lng, lat].
  const [longitude, latitude] = coords as [number, number];
  const city = typeof b.city === "string" ? b.city : "";
  const adminName = typeof b.admin_name === "string" ? b.admin_name : "";
  const label = [city, adminName].filter(Boolean).join(", ") || undefined;
  return { latitude, longitude, label };
};

type PatchedXHRPrototype = typeof XMLHttpRequest.prototype & {
  __sniffiesCitySearchPatched?: boolean;
};
type XhrWithCityFlag = XMLHttpRequest & { __sniffiesIsCitySearch?: boolean };

/**
 * Watches for GET /api/city/{id} XHR responses and reports the extracted
 * result (or null if the response didn't parse/match). Read-only — unlike
 * bot-block-hook's XHR patch, this never needs to rewrite what the app sees,
 * so it just listens for "load" and reads the native responseText rather
 * than overriding the response/responseText getters.
 */
export const installCitySearchXhrObserver = (
  onResponse: (result: CitySearchResult | null) => void,
): void => {
  const proto = XMLHttpRequest.prototype as PatchedXHRPrototype;
  if (proto.__sniffiesCitySearchPatched) {
    return;
  }

  const nativeOpen = proto.open;
  const nativeSend = proto.send;

  proto.open = function (
    this: XhrWithCityFlag,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__sniffiesIsCitySearch = isCitySearchUrl(url.toString());
    return (nativeOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
  } as typeof proto.open;

  proto.send = function (this: XhrWithCityFlag, ...args: unknown[]) {
    if (this.__sniffiesIsCitySearch) {
      this.addEventListener("load", () => {
        try {
          const body: unknown = JSON.parse(this.responseText);
          onResponse(extractCitySearchResult(body));
        } catch {
          onResponse(null);
        }
      });
    }
    return (nativeSend as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof proto.send;

  proto.__sniffiesCitySearchPatched = true;
};
