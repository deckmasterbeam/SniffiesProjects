import type { GeoOverride } from "./settings.js";

type PatchedGeo = Geolocation & { __sniffiesPatched?: boolean };

export interface GeoHookResult {
  nativeGetCurrentPosition: Geolocation["getCurrentPosition"];
  nativeWatchPosition: Geolocation["watchPosition"];
  /** Re-fires all active watchPosition subscribers with the current real position. Call this whenever the override changes so active watches reflect the new state immediately. */
  refreshWatches: () => void;
}

/**
 * Wraps navigator.geolocation to intercept position calls.
 *
 * @param getOverride - Called on every position request; return null to pass through real coords.
 * @param onPosition  - Optional callback fired with the real (pre-spoof) coords, useful for
 *                      relaying observed positions back to a storage layer.
 * @returns Native geo methods (needed by callers that must bypass the hook, e.g. "fill with
 *          current" in a UI running on the same page), or null if already patched.
 */
export const installGeoHook = (
  getOverride: () => GeoOverride | null,
  onPosition?: (coords: { latitude: number; longitude: number; accuracy: number }) => void,
): GeoHookResult | null => {
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
    if (!ov?.enabled) {
      return position;
    }
    return {
      coords: {
        latitude: ov.latitude,
        longitude: ov.longitude,
        accuracy: ov.accuracy,
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
      onPosition?.({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      callback(applyOverride(position));
    };

  geo.getCurrentPosition = (success, error, options) =>
    nativeGetCurrentPosition(wrapSuccess(success), error, options);

  geo.watchPosition = (success, error, options) => {
    const wrapped = wrapSuccess(success);
    const id = nativeWatchPosition(wrapped, error, options);
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
