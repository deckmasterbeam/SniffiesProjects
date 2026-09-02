// Every real-sniffies.com DOM selector our code depends on, centralized here
// instead of duplicated as string literals across client/, userscript/, and
// bookmarklet/ (which is what caused the FAB mount selector to exist as two
// independent copies before this file). These are reverse-engineered and can
// change without notice — see core/src/bot-block-hook.ts's header for a case
// where that already happened to an API host.
//
// SNIFFIES_SELECTORS below is the actual source of truth; the individual
// named consts are destructured from it purely so existing call sites can
// keep importing them by name. e2e/site-contract.ts (the drift canary) keys
// its metadata off `SniffiesSelectorName` (derived from this object's keys),
// so adding a selector here without also describing it there is a type
// error in site-contract.ts, not a silent gap.

export const SNIFFIES_SELECTORS = {
  /**
   * Marker container carrying data-within-radius — profile-border-hook.ts's
   * redirect target. Confirmed live (2026-09-01): a zero-size positioning
   * anchor (0x0 bounding box, `visibility:visible`) — the actual pixels come
   * from an absolutely-positioned child. Only ever queried via `.closest()`
   * on a click and read for its data attributes, never expected to have a
   * layout box of its own — so a presence check (Playwright's `toBeAttached`)
   * is correct here, not a visibility check (`toBeVisible`, which requires a
   * non-empty bounding box and will always fail on this element).
   */
  MARKER_CONTAINER_SELECTOR: '[data-testid="markerUserContainer"]',
  /** Map marker avatar image — click target that resolves a profile's user id. */
  MARKER_AVATAR_SELECTOR: '[data-testid="cv-marker-avatar-image"]',
  /** Profile panel root, hosts the name label and pin button. */
  APP_SCREEN_SELECTOR: "#app-screen",
  /** Cruiser name label inside the open profile panel. */
  NAME_LABEL_SELECTOR: '[data-testid="cruiserNameLabel"]',
  /** Pin-user button — the report button is anchored to its parent. */
  PIN_BUTTON_SELECTOR: '[data-testid="pinUserButton"]',
  /** Sidebar nav link used as the FAB's mount anchor (userscript/bookmarklet only). */
  SITELINKS_NAV_SELECTOR: '[title="Sitelinks"]',
} as const;

export type SniffiesSelectorName = keyof typeof SNIFFIES_SELECTORS;

export const {
  MARKER_CONTAINER_SELECTOR,
  MARKER_AVATAR_SELECTOR,
  APP_SCREEN_SELECTOR,
  NAME_LABEL_SELECTOR,
  PIN_BUTTON_SELECTOR,
  SITELINKS_NAV_SELECTOR,
} = SNIFFIES_SELECTORS;
