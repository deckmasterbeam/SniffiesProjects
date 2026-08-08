import UPDATE_BANNER_HTML from "./update-banner.html";
import UPDATE_BANNER_CSS from "./update-banner.css";
import { isUpdateAvailable, type ReleaseChannel } from "./update-check.js";

export { UPDATE_BANNER_HTML, UPDATE_BANNER_CSS };

/**
 * Checks GitHub releases for a newer `channel` build and, if one is
 * published, un-hides the `#snp-update-banner` element inside `container`.
 */
export const wireUpdateBanner = (
  container: Element,
  channel: ReleaseChannel,
  currentVersion: string,
): void => {
  const el = container.querySelector<HTMLElement>("#snp-update-banner");
  if (!el) return;
  void isUpdateAvailable(channel, currentVersion).then((outOfDate) => {
    if (outOfDate) {
      el.hidden = false;
    }
  });
};
