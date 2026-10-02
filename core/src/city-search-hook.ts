const CITY_ENDPOINT_PATTERN = /\/api\/city\/[^/?]+/;

export const isCitySearchUrl = (url: string): boolean => CITY_ENDPOINT_PATTERN.test(url);

export interface CitySearchResult {
  latitude: number;
  longitude: number;
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

/** Watches for GET /api/city/{id} XHR responses and reports the extracted result */
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
