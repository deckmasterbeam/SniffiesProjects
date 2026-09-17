// All the sniffies.com selectors that we depend on
export const SNIFFIES_SELECTORS = {
  /** Marker container carrying data-within-radius */
  MARKER_CONTAINER_SELECTOR: '[data-testid="markerUserContainer"]',
  /** Map marker avatar image — click target that resolves a profile's user id. */
  MARKER_AVATAR_SELECTOR: '[data-testid="cv-marker-avatar-image"]',
  /** Profile panel root, hosts the name label and pin button. */
  APP_SCREEN_SELECTOR: "#app-screen",
  /** Cruiser name label inside the open profile panel. */
  NAME_LABEL_SELECTOR: '[data-testid="cruiserNameLabel"]',
  /** Pin-user button — the report button is anchored to its parent. */
  PIN_BUTTON_SELECTOR: '[data-testid="pinUserButton"]',
  /** Sidebar nav link used as the FAB's mount anchor (bookmarklet only). */
  SITELINKS_NAV_SELECTOR: '[title="Sitelinks"]',
  /** Map's own travel-mode/hide-me/find-me icon row — the FAB's preferred mount target (userscript only). */
  ICON_HOLDER_RIGHT_BOTTOM_SELECTOR: '[data-testid="iconHolderRightBottom"]',
} as const;

export type SniffiesSelectorName = keyof typeof SNIFFIES_SELECTORS;

export const {
  MARKER_CONTAINER_SELECTOR,
  MARKER_AVATAR_SELECTOR,
  APP_SCREEN_SELECTOR,
  NAME_LABEL_SELECTOR,
  PIN_BUTTON_SELECTOR,
  SITELINKS_NAV_SELECTOR,
  ICON_HOLDER_RIGHT_BOTTOM_SELECTOR,
} = SNIFFIES_SELECTORS;
