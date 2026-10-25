import UPDATE_BANNER_HTML from "./update-banner.html";
import UPDATE_BANNER_CSS from "./update-banner.css";
import { isUpdateAvailable, type ReleaseChannel } from "./update-check.js";

export { UPDATE_BANNER_HTML, UPDATE_BANNER_CSS };

const DISMISS_KEY_PREFIX = "snp-update-dismissed-";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

const isDismissed = (channel: ReleaseChannel): boolean => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY_PREFIX + channel));
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
};

const dismiss = (channel: ReleaseChannel): void => {
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + channel, String(Date.now()));
  } catch {
    // Storage unavailable — it'll just reappear next time.
  }
};

/**
 * Checks GitHub releases for a newer `channel` build and, if one is
 * published, un-hides the `#snp-update-banner` element inside `container`.
 * The user can dismiss it, which keeps it hidden for 24h.
 */
export const wireUpdateBanner = (
  container: Element,
  channel: ReleaseChannel,
  currentVersion: string,
): void => {
  const el = container.querySelector<HTMLElement>("#snp-update-banner");
  if (!el || isDismissed(channel)) return;
  el.querySelector("#snp-update-dismiss")?.addEventListener("click", () => {
    el.hidden = true;
    dismiss(channel);
  });
  void isUpdateAvailable(channel, currentVersion).then((outOfDate) => {
    if (outOfDate) {
      el.hidden = false;
    }
  });
};
