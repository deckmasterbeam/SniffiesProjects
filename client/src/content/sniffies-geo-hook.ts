import {
  installLocationOverrideController,
  DEFAULT_GEO_OVERRIDE,
  type GeoOverride,
  createLogger,
} from "@sniffies-projects/core";

(() => {
  const log = createLogger("geo");

  let premiumEnabled = true;

  const controller = installLocationOverrideController({
    initialOverride: DEFAULT_GEO_OVERRIDE,
    isPremiumEnabled: () => premiumEnabled,
    onOverrideChanged: (next) => {
      window.postMessage(
        { source: "sniffies-geo-hook", kind: "persistOverride", override: next },
        "*",
      );
    },
    onPosition: (coords) => {
      log("position", coords);
      window.postMessage({ source: "sniffies-geo-hook", kind: "position", coords }, "*");
    },
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const msg = event.data as Record<string, unknown> | null;
    if (!msg || msg.source !== "sniffies-geo-relay" || msg.kind !== "override") {
      return;
    }
    premiumEnabled = msg.premiumFeaturesEnabled !== false;
    const override = (msg.override as GeoOverride | undefined) ?? DEFAULT_GEO_OVERRIDE;
    log("override synced from storage", override);
    controller.syncOverride(override);
  });

  log("location override controller installed");
})();
