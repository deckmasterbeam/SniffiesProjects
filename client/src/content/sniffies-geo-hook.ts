// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Wraps navigator.geolocation to observe calls and optionally spoof position.

import { createLogger } from "../shared/log.js";

(() => {
  const log = createLogger("geo");

  type PatchedGeo = Geolocation & { __sniffiesPatched?: boolean };
  const geo = navigator.geolocation as PatchedGeo | undefined;
  if (!geo || geo.__sniffiesPatched) {
    return;
  }

  interface OverrideCoords {
    latitude: number;
    longitude: number;
    accuracy: number;
  }

  let override: OverrideCoords | null = null;

  // Receive override settings from isolated world
  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const msg = event.data as Record<string, unknown> | null;
    if (!msg || msg.source !== "sniffies-geo-relay") {
      return;
    }
    override = (msg.coords as OverrideCoords) ?? null;
    log("override updated", override);
  });

  const applyOverride = (position: GeolocationPosition): GeolocationPosition => {
    if (!override) {
      return position;
    }
    return {
      coords: {
        latitude: override.latitude,
        longitude: override.longitude,
        accuracy: override.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition;
  };

  const wrapSuccess =
    (callback: PositionCallback): PositionCallback =>
    (position) => {
      log("position", {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      window.postMessage(
        {
          source: "sniffies-geo-hook",
          kind: "position",
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        },
        "*",
      );
      callback(applyOverride(position));
    };

  const nativeGetCurrentPosition = geo.getCurrentPosition.bind(geo);
  const nativeWatchPosition = geo.watchPosition.bind(geo);

  geo.getCurrentPosition = (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): void => {
    log("getCurrentPosition called");
    nativeGetCurrentPosition(wrapSuccess(success), error, options);
  };

  geo.watchPosition = (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): number => {
    log("watchPosition called");
    return nativeWatchPosition(wrapSuccess(success), error, options);
  };

  geo.__sniffiesPatched = true;
  log("geolocation hook installed");
})();
