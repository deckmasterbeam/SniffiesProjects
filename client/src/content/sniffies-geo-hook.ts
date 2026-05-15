// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Wraps navigator.geolocation to observe calls and optionally spoof position.

(() => {
  const TAG = "[sniffies-geo]";

  type PatchedGeo = Geolocation & { __sniffiesPatched?: boolean };
  const geo = navigator.geolocation as PatchedGeo | undefined;
  if (!geo || geo.__sniffiesPatched) return;

  interface OverrideCoords {
    latitude: number;
    longitude: number;
    accuracy: number;
  }

  let override: OverrideCoords | null = null;

  // Receive override settings from isolated world
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data as Record<string, unknown> | null;
    if (!msg || msg.source !== "sniffies-geo-relay") return;
    override = (msg.coords as OverrideCoords) ?? null;
    console.log(TAG, "override updated", override);
  });

  const applyOverride = (position: GeolocationPosition): GeolocationPosition => {
    if (!override) return position;
    const ov = override;
    return {
      coords: {
        latitude: ov.latitude,
        longitude: ov.longitude,
        accuracy: ov.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON() {
          return this;
        },
      },
      timestamp: Date.now(),
      toJSON() {
        return this;
      },
    } as GeolocationPosition;
  };

  const wrapSuccess = (callback: PositionCallback): PositionCallback =>
    (position) => {
      console.log(TAG, "position", {
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

  geo.getCurrentPosition = function (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) {
    console.log(TAG, "getCurrentPosition called");
    nativeGetCurrentPosition(wrapSuccess(success), error, options);
  };

  geo.watchPosition = function (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) {
    console.log(TAG, "watchPosition called");
    return nativeWatchPosition(wrapSuccess(success), error, options);
  };

  geo.__sniffiesPatched = true;
  console.log(TAG, "geolocation hook installed");
})();
