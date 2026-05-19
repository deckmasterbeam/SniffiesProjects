// Isolated world. Reads geo override from extension storage and forwards it
// to the MAIN world geo hook via window.postMessage.

import { createLogger } from "../shared/log.js";
import { SETTINGS_KEYS, getLocalSettings, type GeoOverride } from "../shared/settings.js";

const log = createLogger("geo-relay");

const postOverride = (override: GeoOverride): void => {
  window.postMessage(
    {
      source: "sniffies-geo-relay",
      coords: override.enabled
        ? {
            latitude: override.latitude,
            longitude: override.longitude,
            accuracy: override.accuracy,
          }
        : null,
    },
    "*",
  );
};

void getLocalSettings().then(({ geoOverride }) => {
  postOverride(geoOverride);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  const change = changes[SETTINGS_KEYS.geoOverride];
  if (change) {
    postOverride(change.newValue as GeoOverride);
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const msg = event.data as Record<string, unknown> | null;
  if (!msg || msg.source !== "sniffies-geo-hook" || msg.kind !== "position") {
    return;
  }
  log("position observed by Sniffies", msg.coords);
});
