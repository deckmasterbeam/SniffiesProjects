import type { ProfileBorderOpen } from "./settings.js";
import { createLogger } from "./log.js";
import { MARKER_CONTAINER_SELECTOR } from "./sniffies-selectors.js";

export interface ProfileBorderHookResult {
  uninstall: () => void;
}

/**
 * Installs a capturing document click listener that opens a profile marker's
 * page directly when it falls outside the viewer's boundary radius
 * (dataset.withinRadius === "false"), bypassing Sniffies' own paywall-gated
 * click handling. Uses stopImmediatePropagation so other capture-phase click
 * listeners on document (e.g. favorites marker handling) don't also fire for
 * the same click.
 *
 * @param getSettings - Called on every click to read the current enabled/openInNewTab state.
 */
export const installProfileBorderRedirect = (
  getSettings: () => ProfileBorderOpen,
): ProfileBorderHookResult => {
  const log = createLogger("profile-border");

  const handler = (event: MouseEvent): void => {
    const settings = getSettings();
    if (!settings.enabled) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const container = target.closest<HTMLElement>(MARKER_CONTAINER_SELECTOR);
    if (!container || container.dataset.withinRadius !== "false" || !container.id) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const url = `https://sniffies.com/profile/${container.id}`;
    log("redirecting to out-of-radius profile", container.id);
    if (settings.openInNewTab) {
      window.open(url, "_blank");
    } else {
      window.location.assign(url);
    }
  };

  document.addEventListener("click", handler, true);

  return {
    uninstall: () => document.removeEventListener("click", handler, true),
  };
};
