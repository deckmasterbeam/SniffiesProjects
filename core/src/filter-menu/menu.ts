import type { ProfileFiltersMenuContract } from "@core/contracts.js";
import { GENDER_ROW, profileTypeRow } from "@core/filter-menu/gender-row.js";
import FILTER_MENU_CSS from "@core/filter-menu/menu.css";
import { cruisingNowRow, ONLINE_ROW } from "@core/filter-menu/online-row.js";
import { RANGE_ROWS } from "@core/filter-menu/range-row.js";
import { type Row } from "@core/filter-menu/row.js";
import { createOwnedSync, STAT_ROWS } from "@core/filter-menu/stat-row.js";
import { createLogger } from "@core/log.js";
import { STRINGS } from "@core/strings.js";

const STYLE_ID = "snp-filter-menu-style";

const ROWS: Row[] = [...STAT_ROWS, GENDER_ROW, ONLINE_ROW, ...RANGE_ROWS];

const log = createLogger("filter-menu");
const reportedAnchors = new Set<string>();
const warnOnce = (key: string, message: string): void => {
  if (!reportedAnchors.has(key)) {
    reportedAnchors.add(key);
    log.warn(`${message}; Sniffies may have changed its markup`);
  }
};
// Angular renders the menu in pieces, so a missing neighbour only counts once it stays missing.
const NEIGHBOUR_GRACE_MS = 2000;

export const installProfileFiltersMenu = (options: ProfileFiltersMenuContract): (() => void) => {
  const filters = structuredClone(options.initial);
  const syncs = new Map<string, () => void>();

  const changed = (): void => {
    for (const sync of syncs.values()) {
      sync();
    }
    syncOwned();
    Promise.resolve(options.onChange(structuredClone(filters))).catch((error) => {
      log.warn("couldn't save filters", error);
    });
  };

  const syncOwned = createOwnedSync(filters);

  const makeApply = (): HTMLButtonElement => {
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "snp-filter-apply";
    apply.textContent = STRINGS.filterMenu.reloadToApply;
    apply.addEventListener("click", (event) => {
      event.stopPropagation();
      (options.reloadPage ?? (() => location.reload()))();
    });
    return apply;
  };

  const build = (anchor: Element, row: Row): HTMLElement | null => {
    const mounted = row.build(anchor, filters, changed);
    if (!mounted) {
      return null;
    }
    mounted.root.id = row.id;
    mounted.root.classList.add("snp-filter-row");

    const apply = makeApply();
    mounted.placeApply(apply);

    const sync = (): void => {
      apply.hidden = row.key(filters) === row.key(options.applied);
      mounted.sync(!apply.hidden);
    };
    syncs.set(row.id, sync);
    sync();
    return mounted.root;
  };

  const render = (): void => {
    syncOwned();
    if (ROWS.every((row) => document.getElementById(row.id))) {
      return;
    }
    const lastAfter = new Map<Element, Element>();
    for (const row of ROWS) {
      const anchor = row.anchor();
      if (!anchor) {
        continue;
      }
      const root = document.getElementById(row.id) ?? build(anchor, row);
      if (!root) {
        warnOnce(row.id, `${row.id}: found its anchor but not the parts to clone from it`);
        continue;
      }
      if (!root.isConnected) {
        if (!document.getElementById(STYLE_ID)) {
          const style = document.createElement("style");
          style.id = STYLE_ID;
          style.textContent = FILTER_MENU_CSS;
          document.head.appendChild(style);
        }
        (lastAfter.get(anchor) ?? anchor).after(root);
      }
      lastAfter.set(anchor, root);
    }
  };

  // Profile Type and Cruising Now sit in the same menu: one without the other means it changed.
  let neighbourCheck: ReturnType<typeof setTimeout> | undefined;
  const checkNeighbours = (): void => {
    const [type, cruising] = [profileTypeRow(), cruisingNowRow()];
    if (!type !== !cruising) {
      neighbourCheck ??= setTimeout(() => {
        neighbourCheck = undefined;
        const [t, c] = [profileTypeRow(), cruisingNowRow()];
        if (!t !== !c) {
          warnOnce(
            "menu-neighbours",
            `filter menu has ${t ? "Profile Type" : "Cruising Now"} but not ${t ? "Cruising Now" : "Profile Type"}`,
          );
        }
      }, NEIGHBOUR_GRACE_MS);
    }
  };

  const observer = new MutationObserver(() => {
    render();
    checkNeighbours();
  });
  const start = (): void => {
    observer.observe(document.body, { childList: true, subtree: true });
    render();
  };
  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
  return () => {
    document.removeEventListener("DOMContentLoaded", start);
    observer.disconnect();
    clearTimeout(neighbourCheck);
    for (const row of ROWS) {
      document.getElementById(row.id)?.remove();
    }
    document
      .querySelectorAll(".snp-native-hidden")
      .forEach((el) => el.classList.remove("snp-native-hidden"));
  };
};
