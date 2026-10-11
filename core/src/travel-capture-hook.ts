import { createLogger } from "./log.js";
import type { LocationPutBody } from "./sniffies-api.js";
import { TRAVEL_HERE_BUTTON_SELECTOR } from "./sniffies-selectors.js";

const log = createLogger("travel-capture");
const ARM_TIMEOUT_MS = 5000;

export interface TravelClickArmer {
  consume: () => boolean;
}

/**
 * Watches for clicks on Sniffies' own "Travel here" button.
 * @param onClick Fired synchronously on every matching click
 */
export const installTravelClickArmer = (onClick?: () => void): TravelClickArmer => {
  let armed = false;
  let disarmTimer: ReturnType<typeof setTimeout> | null = null;

  const disarm = (): void => {
    armed = false;
    if (disarmTimer) {
      clearTimeout(disarmTimer);
      disarmTimer = null;
    }
  };

  log(`watching for clicks matching ${TRAVEL_HERE_BUTTON_SELECTOR}`);

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(TRAVEL_HERE_BUTTON_SELECTOR)) {
        return;
      }
      log("travel here clicked, arming capture for", ARM_TIMEOUT_MS, "ms");
      onClick?.();
      armed = true;
      if (disarmTimer) {
        clearTimeout(disarmTimer);
      }
      disarmTimer = setTimeout(() => {
        log("armed window expired with no matching location PUT seen");
        disarm();
      }, ARM_TIMEOUT_MS);
    },
    true,
  );

  return {
    consume: () => {
      const wasArmed = armed;
      log("consume() called, was armed:", wasArmed);
      disarm();
      return wasArmed;
    },
  };
};

/** Extracts the destination coords from /api/visitor/current/location PUT body */
export const extractTravelDestination = (
  body: unknown,
): { latitude: number; longitude: number } | null => {
  if (!body || typeof body !== "object") {
    return null;
  }
  const loc = (body as LocationPutBody).virtualLocation;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    return null;
  }
  return { latitude: loc.lat, longitude: loc.lng };
};
