import type { GeoOverride } from "./settings.js";
import { hasCapturedCoords } from "./settings.js";
import { createLogger } from "./log.js";

type PatchedGeo = Geolocation & { __sniffiesPatched?: boolean };

export interface GeoHookResult {
  nativeGetCurrentPosition: Geolocation["getCurrentPosition"];
  nativeWatchPosition: Geolocation["watchPosition"];
  refreshWatches: () => void;
}

/**
 * Wraps navigator.geolocation to intercept position calls.
 * @param getOverride Called on every position request. Return null to pass through real coords
 * @param onPosition Optional callback fired with the real coords
 * @returns geo methods
 */
export const installGeoHook = (
  getOverride: () => GeoOverride | null,
  onPosition?: (coords: { latitude: number; longitude: number }) => void,
): GeoHookResult | null => {
  const log = createLogger("geo");
  const geo = navigator.geolocation as PatchedGeo | undefined;
  if (!geo || geo.__sniffiesPatched) {
    return null;
  }

  const nativeGetCurrentPosition = geo.getCurrentPosition.bind(geo);
  const nativeWatchPosition = geo.watchPosition.bind(geo);
  const nativeClearWatch = geo.clearWatch.bind(geo);

  const activeWatchers = new Map<number, PositionCallback>();

  const applyOverride = (position: GeolocationPosition): GeolocationPosition => {
    const ov = getOverride();
    if (!ov?.enabled || !hasCapturedCoords(ov)) {
      log("override disabled or no location captured yet, passing real coords", position.coords);
      return position;
    }
    const spoofed = {
      coords: {
        latitude: ov.latitude,
        longitude: ov.longitude,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as GeolocationPosition;
    log("applying override", spoofed.coords);
    return spoofed;
  };

  const wrapSuccess =
    (callback: PositionCallback): PositionCallback =>
    (position) => {
      onPosition?.({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      callback(applyOverride(position));
    };

  // Without this, a denied/blocked/timed-out native geolocation call fails
  // silently on our end — the site's own error callback still fires, but
  // nothing here logs it, so "intercepted" appears to hang forever with no
  // clue why the success path (and any override) never ran.
  const wrapError =
    (callback: PositionErrorCallback | null | undefined): PositionErrorCallback =>
    (err) => {
      log("native geolocation call failed", { code: err.code, message: err.message });
      callback?.(err);
    };

  geo.getCurrentPosition = (success, error, options) => {
    log("getCurrentPosition intercepted");
    nativeGetCurrentPosition(wrapSuccess(success), wrapError(error), options);
  };

  geo.watchPosition = (success, error, options) => {
    log("watchPosition intercepted");
    const wrapped = wrapSuccess(success);
    const id = nativeWatchPosition(wrapped, wrapError(error), options);
    activeWatchers.set(id, wrapped);
    return id;
  };

  geo.clearWatch = (id) => {
    activeWatchers.delete(id);
    nativeClearWatch(id);
  };

  const refreshWatches = (): void => {
    if (activeWatchers.size === 0) {
      return;
    }
    nativeGetCurrentPosition(
      (pos) => {
        for (const cb of activeWatchers.values()) {
          cb(pos);
        }
      },
      undefined,
      { maximumAge: 0 },
    );
  };

  geo.__sniffiesPatched = true;

  return { nativeGetCurrentPosition, nativeWatchPosition, refreshWatches };
};
