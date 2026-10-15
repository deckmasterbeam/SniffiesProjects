import { createLogger, type GeoOverride } from "@sniffies-projects/core";
import { SETTINGS_KEYS, getLocalSettings, setGeoOverride } from "../shared/settings.js";

const log = createLogger("geo-relay");

const postOverride = (override: GeoOverride, premiumFeaturesEnabled: boolean): void => {
  window.postMessage(
    { source: "sniffies-geo-relay", kind: "override", override, premiumFeaturesEnabled },
    "*",
  );
};

void getLocalSettings().then(({ geoOverride, premiumFeaturesEnabled, premiumFeatureFlags }) => {
  postOverride(geoOverride, premiumFeaturesEnabled && premiumFeatureFlags.location);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  if (
    changes[SETTINGS_KEYS.geoOverride] ||
    changes[SETTINGS_KEYS.premiumFeaturesEnabled] ||
    changes[SETTINGS_KEYS.premiumFeatureFlags]
  ) {
    void getLocalSettings().then(({ geoOverride, premiumFeaturesEnabled, premiumFeatureFlags }) => {
      postOverride(geoOverride, premiumFeaturesEnabled && premiumFeatureFlags.location);
    });
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const msg = event.data as Record<string, unknown> | null;
  if (!msg || msg.source !== "sniffies-geo-hook") {
    return;
  }
  if (msg.kind === "persistOverride") {
    log("persisting override captured in MAIN world", msg.override);
    void setGeoOverride(msg.override as GeoOverride);
  } else if (msg.kind === "position") {
    log("position observed by Sniffies", msg.coords);
  }
});
