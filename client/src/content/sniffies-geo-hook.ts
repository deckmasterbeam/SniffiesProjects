// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Wraps navigator.geolocation to observe calls and optionally spoof position.

import { installGeoHook, type GeoOverride } from "@sniffies-projects/core";
import { createLogger } from "../shared/log.js";

(() => {
  const log = createLogger("geo");

  let override: GeoOverride | null = null;
  let hook: ReturnType<typeof installGeoHook> = null;

  // Receive override settings from the isolated-world relay via postMessage.
  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const msg = event.data as Record<string, unknown> | null;
    if (!msg || msg.source !== "sniffies-geo-relay") {
      return;
    }
    override = (msg.coords as GeoOverride) ?? null;
    log("override updated", override);
    hook?.refreshWatches();
  });

  hook = installGeoHook(
    () => override,
    (coords) => {
      log("position", coords);
      window.postMessage({ source: "sniffies-geo-hook", kind: "position", coords }, "*");
    },
  );

  if (hook) {
    log("geolocation hook installed");
  }
})();
