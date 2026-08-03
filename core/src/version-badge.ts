import VERSION_BADGE_HTML from "./version-badge.html";
import VERSION_BADGE_CSS from "./version-badge.css";

export { VERSION_BADGE_HTML, VERSION_BADGE_CSS };

/** Renders `version` into the `#snp-version` element inside `container`. */
export const wireVersionBadge = (container: Element, version: string): void => {
  const el = container.querySelector<HTMLElement>("#snp-version");
  if (el) {
    el.textContent = `v${version}`;
  }
};
