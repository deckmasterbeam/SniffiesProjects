import type { ProfileFilters } from "../profile-filter.js";

export interface MountedRow {
  root: HTMLElement;
  /** Re-reads the filters into the row. `needsReload`: the "Reload to apply" button is showing. */
  sync: (needsReload: boolean) => void;
  /** place the row's "Reload to apply" button */
  placeApply: (apply: HTMLElement) => void;
}

/** One row we add to Sniffies' Cruisers filter menu. Add an entry to ROWS for a new filter. */
export interface Row {
  id: string;
  /** The Sniffies row this one is cloned from and placed after; null while it isn't on screen. */
  anchor: () => Element | null;
  /** What the row currently filters for — a different value than at page load needs a reload. */
  key: (filters: ProfileFilters) => string;
  /** Clones `anchor` into our row. Its controls edit `filters` in place, then call `changed`. */
  build: (anchor: Element, filters: ProfileFilters, changed: () => void) => MountedRow | null;
}

export const stripTestIds = (root: Element): void => {
  for (const el of root.querySelectorAll("[data-testid]")) {
    el.removeAttribute("data-testid");
  }
};
