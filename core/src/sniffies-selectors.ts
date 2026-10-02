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
  /** Pin-user button — its appearance signals a (re)rendered profile panel. */
  PIN_BUTTON_SELECTOR: '[data-testid="pinUserButton"]',
  /** Profile three-dot options menu (only in the DOM while open) — the report button mounts inside it. */
  PROFILE_OPTIONS_MENU_SELECTOR: '[data-testid="profileOptionsContainer"]',
  /** Sidebar nav link used as the FAB's mount anchor (bookmarklet only). */
  SITELINKS_NAV_SELECTOR: '[title="Sitelinks"]',
  /** Map's own travel-mode/hide-me/find-me icon row — the FAB's preferred mount target (userscript only). */
  ICON_HOLDER_RIGHT_BOTTOM_SELECTOR: '[data-testid="iconHolderRightBottom"]',
  /** Confirm button in Sniffies' own Travel Mode UI — clicking it PUTs the picked pin to the location API. */
  TRAVEL_HERE_BUTTON_SELECTOR: '[data-testid="travelHereButton"]',
  /** Travel Mode's city search box — anchors the pending-capture status message next to it. */
  CITIES_INPUT_SELECTOR: '[data-testid="citiesInput"]',
} as const;

export type SniffiesSelectorName = keyof typeof SNIFFIES_SELECTORS;

export const {
  MARKER_CONTAINER_SELECTOR,
  MARKER_AVATAR_SELECTOR,
  APP_SCREEN_SELECTOR,
  NAME_LABEL_SELECTOR,
  PIN_BUTTON_SELECTOR,
  PROFILE_OPTIONS_MENU_SELECTOR,
  SITELINKS_NAV_SELECTOR,
  ICON_HOLDER_RIGHT_BOTTOM_SELECTOR,
  TRAVEL_HERE_BUTTON_SELECTOR,
  CITIES_INPUT_SELECTOR,
} = SNIFFIES_SELECTORS;
