import type { LocationOverrideControllerOptions } from "./contracts.js";
import { installCitySearchXhrObserver } from "./city-search-hook.js";
import { installCitySearchStatusUI } from "./city-search-status-hook.js";
import { installGeoHook } from "./geo-hook.js";
import { hasCapturedCoords, type GeoOverride } from "./settings.js";
import { LOCATION_PATH, type LocationPutBody } from "./sniffies-api.js";
import { extractTravelDestination, installTravelClickArmer } from "./travel-capture-hook.js";
import { createLogger } from "./log.js";

const log = createLogger("location-override");

const RELOAD_SAFETY_TIMEOUT_MS = 4000;

export interface LocationOverrideController {
  getOverride: () => GeoOverride;
  setOverride: (next: GeoOverride) => void;
  syncOverride: (next: GeoOverride) => void;
  subscribeChange: (cb: (next: GeoOverride) => void) => void;
  sendLocationUpdate: (override: GeoOverride) => Promise<void>;
}

export const installLocationOverrideController = (
  options: LocationOverrideControllerOptions,
): LocationOverrideController => {
  const reloadPage = options.reloadPage ?? (() => location.reload());

  let currentOverride: GeoOverride = options.initialOverride;
  const hook = installGeoHook(() => currentOverride, options.onPosition);

  const nativeFetch = window.fetch.bind(window);
  let lastLocationRequest: { url: string; init: RequestInit } | null = null;
  let apiBase: string | null = null;
  let onChange: ((next: GeoOverride) => void) | null = null;

  const notify = (next: GeoOverride): void => {
    currentOverride = next;
    hook?.refreshWatches();
    onChange?.(next);
  };

  const setOverride = (next: GeoOverride): void => {
    notify(next);
    options.onOverrideChanged(next);
  };

  const syncOverride = (next: GeoOverride): void => {
    notify(next);
  };

  const sendLocationUpdate = (override: GeoOverride): Promise<void> => {
    const spoofed = { lat: override.latitude, lng: override.longitude };
    if (lastLocationRequest) {
      try {
        const body = JSON.parse(
          (lastLocationRequest.init.body as string) ?? "{}",
        ) as LocationPutBody;
        body.virtualLocation = spoofed;
        body.physicalLocation = spoofed;
        return nativeFetch(lastLocationRequest.url, {
          ...lastLocationRequest.init,
          body: JSON.stringify(body),
        }).then(() => undefined);
      } catch {
        // fall through to proactive request
      }
    }
    if (apiBase) {
      return nativeFetch(`${apiBase}${LOCATION_PATH}?state=loaded`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          virtualLocation: spoofed,
          physicalLocation: spoofed,
          homeDistanceInMiles: null,
        } satisfies LocationPutBody),
      }).then(() => undefined);
    }
    return Promise.resolve();
  };

  let pendingSearchOverride: GeoOverride | null = null;
  const citySearchStatusUI = installCitySearchStatusUI();

  const commitPendingSearchOverride = (): void => {
    if (!pendingSearchOverride) {
      return;
    }
    const next = pendingSearchOverride;
    pendingSearchOverride = null;
    citySearchStatusUI.clear();
    log("travel here clicked — committing pending search location", next);
    setOverride(next);

    const pushed = sendLocationUpdate(next).catch((err) => {
      log("proactive location update failed", err);
    });
    const timedOut = new Promise<void>((resolve) => setTimeout(resolve, RELOAD_SAFETY_TIMEOUT_MS));
    void Promise.race([pushed, timedOut]).then(() => {
      log("reloading to show the newly confirmed location");
      reloadPage();
    });
  };

  const travelArmer = installTravelClickArmer(commitPendingSearchOverride);

  // City search (GET /api/city/{id})
  installCitySearchXhrObserver((result) => {
    log("city search response seen (XHR)", { result, spoofingEnabled: currentOverride.enabled });
    if (!currentOverride.enabled) {
      log("spoofing not enabled — skipping city search capture");
      return;
    }
    if (result) {
      pendingSearchOverride = {
        enabled: true,
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label,
      };
      log("staged pending search location", pendingSearchOverride);
      citySearchStatusUI.showPending(result.label ?? `${result.latitude}, ${result.longitude}`);
    } else {
      log("city search response had no usable location to capture");
    }
  });

  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const baseMatch = url.match(/^(https?:\/\/[^/]*sniffies\.com)/);
    if (baseMatch && !apiBase) {
      apiBase = baseMatch[1] ?? null;
    }
    if (url.includes(LOCATION_PATH)) {
      lastLocationRequest = { url, init: { ...init } };
      const wasArmed = travelArmer.consume();

      log("location PUT seen", { url, wasArmed, spoofingEnabled: currentOverride.enabled });

      if (wasArmed && currentOverride.enabled) {
        try {
          const body = JSON.parse((init?.body as string) ?? "{}") as LocationPutBody;
          const captured = extractTravelDestination(body);
          log("parsed travel PUT body", { body, captured });
          if (captured) {
            setOverride({ enabled: true, ...captured });
            log("saved captured override", currentOverride);
          } else {
            log("armed travel click but PUT body had no virtualLocation to capture", body);
          }
        } catch (err) {
          log("failed to parse/capture travel PUT body", err);
        }
      } else if (currentOverride.enabled && hasCapturedCoords(currentOverride)) {
        try {
          const body = JSON.parse((init?.body as string) ?? "{}") as LocationPutBody;
          const spoofed = { lat: currentOverride.latitude, lng: currentOverride.longitude };
          body.virtualLocation = spoofed;
          body.physicalLocation = spoofed;
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          // leave unmodified if parsing fails
        }
      }
    }
    return nativeFetch(input, init);
  };

  return {
    getOverride: () => currentOverride,
    setOverride,
    syncOverride,
    subscribeChange: (cb) => {
      onChange = cb;
    },
    sendLocationUpdate,
  };
};
