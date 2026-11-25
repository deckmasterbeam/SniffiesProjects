import VERSION_BADGE_CSS from "@core/version-badge.css";
import VERSION_BADGE_HTML from "@core/version-badge.html";

export { VERSION_BADGE_CSS, VERSION_BADGE_HTML };

/** Renders `version` into the `#snp-version` element inside `container`. */
export const wireVersionBadge = (container: Element, version: string): void => {
  const el = container.querySelector<HTMLElement>("#snp-version");
  if (el) {
    el.textContent = `v${version}`;
  }
};
