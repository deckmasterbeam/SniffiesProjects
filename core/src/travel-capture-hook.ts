// Lets the extension observe the destination the user picks with Sniffies'
// own Travel Mode UI (drop a pin, tap "Travel here") instead of requiring a
// manual lat/lng entry. A click on the travel-here button arms a short
// window; the PUT to the location API that follows carries the picked
// {lat, lng} in its body, which the caller's fetch patch can read via
// extractTravelDestination and persist as the new override.

import { createLogger } from "./log.js";
import { TRAVEL_HERE_BUTTON_SELECTOR } from "./sniffies-selectors.js";

const log = createLogger("travel-capture");

// How long a "Travel here" click stays armed while waiting for the PUT it
// triggers — long enough to cover a normal request round trip, short enough
// that an unrelated later PUT (e.g. the click got paywalled and never sent
// one) can't get misread as the travel destination.
const ARM_TIMEOUT_MS = 5000;

export interface TravelClickArmer {
  /**
   * True if a "Travel here" click fired since the last consume() and hasn't
   * timed out yet. Always resets the armed state, so each PUT only gets to
   * claim one click.
   */
  consume: () => boolean;
}

/**
 * Watches for clicks on Sniffies' own "Travel here" button.
 * @param onClick Fired synchronously on every matching click, before arming
 * — lets a caller commit a pending, not-yet-confirmed capture (e.g. from a
 * city search) the moment the user confirms intent to travel, independent of
 * whether a location PUT ever follows (it doesn't, on paywalled accounts).
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

/** Extracts the destination coordinates from a /api/visitor/current/location PUT body, if present. */
export const extractTravelDestination = (
  body: unknown,
): { latitude: number; longitude: number } | null => {
  if (!body || typeof body !== "object") {
    return null;
  }
  const loc = (body as Record<string, unknown>).virtualLocation as
    | { lat?: unknown; lng?: unknown }
    | undefined;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    return null;
  }
  return { latitude: loc.lat, longitude: loc.lng };
};
