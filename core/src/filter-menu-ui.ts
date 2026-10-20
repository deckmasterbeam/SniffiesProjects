import type { ProfileFiltersMenuContract } from "./contracts.js";
import { createLogger } from "./log.js";
import FILTER_MENU_CSS from "./filter-menu.css";
import {
  GENDERS,
  HEIGHT_OPTIONS,
  WEIGHT_OPTIONS,
  allowedGenders,
  ONLINE_MINUTES,
  onlineKey,
  onlineLabel,
  onlineSinceLabel,
  rangeKey,
  rangeLabel,
  type Gender,
  type ProfileFilters,
  type RangeFilter,
  type RangeOptions,
} from "./profile-filter.js";
import { openChoiceFlyout, openRangeFlyout } from "./range-flyout-ui.js";
import {
  CONNECTED_NOW_FILTER_LABEL_SELECTOR,
  ENDOWMENT_FILTER_LABEL_SELECTOR,
  PROFILE_TYPE_FILTER_LABEL_SELECTOR,
} from "./sniffies-selectors.js";

const STYLE_ID = "snp-filter-menu-style";

const PAGE_LOADED_AT = Date.now();

interface MountedRow {
  root: HTMLElement;
  /** Re-reads the filters into the row. `needsReload`: the "Reload to apply" button is showing. */
  sync: (needsReload: boolean) => void;
  /** place the row's "Reload to apply" button */
  placeApply: (apply: HTMLElement) => void;
}

/** One row we add to Sniffies' Cruisers filter menu. Add an entry to ROWS for a new filter. */
interface Row {
  id: string;
  /** The Sniffies row this one is cloned from and placed after; null while it isn't on screen. */
  anchor: () => Element | null;
  /** What the row currently filters for — a different value than at page load needs a reload. */
  key: (filters: ProfileFilters) => string;
  /** Clones `anchor` into our row. Its controls edit `filters` in place, then call `changed`. */
  build: (anchor: Element, filters: ProfileFilters, changed: () => void) => MountedRow | null;
}

const stripTestIds = (root: Element): void => {
  for (const el of root.querySelectorAll("[data-testid]")) {
    el.removeAttribute("data-testid");
  }
};

// ── Gender: a switch row like "Profile Type", with one on/off button per gender ──

const GENDER_ROW_ID = "snp-gender-filter";

const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  nonbinary: "Nonbinary",
  undefined: "Not specified",
};

const buildGenderRow = (
  anchor: Element,
  filters: ProfileFilters,
  changed: () => void,
): MountedRow | null => {
  // Cloning Sniffies "Profile Type" row carries its (Angular-scoped) styling along.
  const root = anchor.cloneNode(true) as HTMLElement;
  const header = root.querySelector(".list-item-level-2");
  const label = root.querySelector("label");
  const title = root.querySelector("p");
  const toggle = root.querySelector<HTMLInputElement>('.trailing input[type="checkbox"]');
  const optionsContainer = root.querySelector(".options-container");
  if (!label || !title || !toggle || !optionsContainer) {
    return null;
  }
  root.classList.remove("last");
  stripTestIds(root);

  toggle.id = `${GENDER_ROW_ID}-enabled`;
  toggle.disabled = false;
  label.htmlFor = toggle.id;
  label.querySelector("i")?.classList.replace("fa-user", "fa-venus-mars");
  title.textContent = " Gender";
  toggle.addEventListener("change", () => {
    filters.gender.enabled = toggle.checked;
    changed();
  });

  const body = document.createElement("div");
  body.className = "snp-filter-body";
  const buttons = GENDERS.map((gender) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "snp-gender-option";
    button.dataset.gender = gender;
    button.textContent = GENDER_LABELS[gender];
    button.addEventListener("click", () => {
      const { genders } = filters.gender;
      if (!genders.includes(gender)) {
        filters.gender.genders = GENDERS.filter((g) => g === gender || genders.includes(g));
      } else if (genders.length > 1) {
        // At least one gender has to stay selected.
        filters.gender.genders = genders.filter((g) => g !== gender);
      } else {
        return;
      }
      changed();
    });
    body.appendChild(button);
    return button;
  });
  optionsContainer.replaceChildren(body);

  return {
    root,
    placeApply: (apply) => body.appendChild(apply),
    sync: () => {
      const { enabled, genders } = filters.gender;
      toggle.checked = enabled;
      header?.classList.toggle("active", enabled);
      body.classList.toggle("snp-filter-off", !enabled);
      for (const button of buttons) {
        const on = genders.includes(button.dataset.gender as Gender);
        button.classList.toggle("active", on);
        button.setAttribute("aria-pressed", String(on));
      }
    },
  };
};

const ONLINE_ROW_ID = "snp-online-filter";

const buildOnlineRow = (
  anchor: Element,
  filters: ProfileFilters,
  changed: () => void,
): MountedRow | null => {
  // Cloning "Cruising Now" carries its styling
  const root = anchor.cloneNode(true) as HTMLElement;
  const header = root.querySelector(".list-item-level-2");
  const titleLine = root.querySelector(".details-title");
  const label = root.querySelector("label");
  const icon = label?.querySelector("i");
  const title = root.querySelector("p");
  const toggle = root.querySelector<HTMLInputElement>('.trailing input[type="checkbox"]');
  const trailing = root.querySelector(".trailing");
  const switchLabel = toggle?.closest("label");
  if (!header || !titleLine || !label || !icon || !title || !toggle || !trailing || !switchLabel) {
    return null;
  }
  stripTestIds(root);

  toggle.id = `${ONLINE_ROW_ID}-enabled`;
  toggle.disabled = false;
  label.removeAttribute("for");
  icon.classList.replace("fa-plug", "fa-clock");
  title.textContent = " Online After";
  toggle.addEventListener("change", () => {
    filters.online.enabled = toggle.checked;
    changed();
  });

  // The cutoff, under the title.
  const since = document.createElement("p");
  since.className = "snp-online-since";
  titleLine.after(since);

  // Clicking the title picks the lookback.
  label.addEventListener("click", (event) => {
    event.preventDefault();
    openChoiceFlyout(
      "Online After",
      ONLINE_MINUTES.map((value) => ({ value, label: onlineLabel(value) })),
      filters.online.minutes,
      (minutes) => {
        filters.online = { enabled: true, minutes, pickedAt: Date.now() };
        changed();
      },
      root.closest("smart-select-filter"),
    );
  });

  return {
    root,
    placeApply: (apply) => trailing.appendChild(apply),
    sync: (needsReload) => {
      const { enabled, minutes } = filters.online;
      const on = enabled && minutes !== null;
      // Something to apply: "Reload to apply" stands in for the switch.
      switchLabel.style.display = needsReload ? "none" : "";
      toggle.checked = on;
      toggle.disabled = minutes === null;
      header.classList.toggle("active", on);
      // The applied cutoff is fixed at page load; a pending pick counts back from when it was made.
      const from = needsReload ? (filters.online.pickedAt ?? Date.now()) : PAGE_LOADED_AT;
      since.textContent = on ? onlineSinceLabel(minutes, from) : "";
      since.style.display = on ? "" : "none";
    },
  };
};

// ── Height / weight ──

const buildStatRow =
  (title: string, pick: (filters: ProfileFilters) => RangeFilter, options: RangeOptions) =>
  (anchor: Element, filters: ProfileFilters, changed: () => void): MountedRow | null => {
    const root = anchor.cloneNode(true) as HTMLElement;
    const group = root.querySelector(".menu-item-group");
    const item = root.querySelector(".list-item");
    const label = root.querySelector("label");
    const checkbox = label?.querySelector("i");
    const name = label?.querySelector("span");
    const statButton = root.querySelector(".stat-button");
    const button = statButton?.querySelector("button");
    const text = button?.querySelector(".text-value");
    if (!group || !item || !label || !checkbox || !name || !statButton || !button || !text) {
      return null;
    }
    const filter = pick(filters);
    stripTestIds(root);

    group.classList.remove("no-border-bottom");
    item.classList.remove("last");
    label.removeAttribute("for");
    name.textContent = title;

    const openSheet = (): void =>
      openRangeFlyout(
        title,
        options,
        filter,
        (next) => {
          Object.assign(filter, next);
          filter.enabled = next.min !== null || next.max !== null;
          changed();
        },
        root.closest("smart-select-filter"),
        checkbox,
      );
    const nativeList = anchor.closest(".smart-options-container");
    let suspended = false;
    const followCruiserStats = (): void => {
      const on = nativeList?.classList.contains("active") ?? true;
      item.classList.toggle("parent-enabled", on);
      if (!on && filter.enabled) {
        suspended = true;
        filter.enabled = false;
        changed();
      } else if (on && suspended) {
        suspended = false;
        filter.enabled = true;
        changed();
      }
    };
    if (nativeList) {
      new MutationObserver(followCruiserStats).observe(nativeList, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
    followCruiserStats();

    label.addEventListener("click", (event) => {
      event.preventDefault();
      if (!item.classList.contains("parent-enabled")) {
        return;
      }
      if (!filter.enabled && filter.min === null && filter.max === null) {
        openSheet();
        return;
      }
      filter.enabled = !filter.enabled;
      changed();
    });
    statButton.addEventListener("click", () => {
      if (item.classList.contains("parent-enabled")) {
        openSheet();
      }
    });

    return {
      root,
      // While there's something to apply, the apply button takes the range button's place
      placeApply: (apply) => button.after(apply),
      sync: (needsReload) => {
        button.style.display = needsReload ? "none" : "";
        label.classList.toggle("active", filter.enabled);
        checkbox.classList.toggle("fa-check-square", filter.enabled);
        checkbox.classList.toggle("fa-square", !filter.enabled);
        statButton.classList.toggle("active", filter.enabled);
        const value = rangeLabel(filter, options);
        button.className = value ? "range" : "select";
        text.classList.toggle("placeholder", !value);
        text.textContent = ` ${value ?? "Select"} `;
      },
    };
  };

const profileTypeRow = (): Element | null =>
  document.querySelector(PROFILE_TYPE_FILTER_LABEL_SELECTOR)?.closest("filter-type-component") ??
  null;
const cruisingNowRow = (): Element | null =>
  document.querySelector(CONNECTED_NOW_FILTER_LABEL_SELECTOR)?.closest("ui-list-item-level-2") ??
  null;
const endowmentLine = (): Element | null =>
  document.querySelector(ENDOWMENT_FILTER_LABEL_SELECTOR)?.closest("ui-menu-item-group") ?? null;

const ROWS: Row[] = [
  {
    id: GENDER_ROW_ID,
    anchor: profileTypeRow,
    key: (f) => allowedGenders(f.gender).join(),
    build: buildGenderRow,
  },
  {
    id: ONLINE_ROW_ID,
    anchor: cruisingNowRow,
    key: (f) => (onlineKey(f.online) ? `${onlineKey(f.online)}@${f.online.pickedAt ?? ""}` : ""),
    build: buildOnlineRow,
  },
  {
    id: "snp-height-filter",
    anchor: endowmentLine,
    key: (f) => rangeKey(f.height),
    build: buildStatRow("Height", (f) => f.height, HEIGHT_OPTIONS),
  },
  {
    id: "snp-weight-filter",
    anchor: endowmentLine,
    key: (f) => rangeKey(f.weight),
    build: buildStatRow("Weight", (f) => f.weight, WEIGHT_OPTIONS),
  },
];

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
    Promise.resolve(options.onChange(structuredClone(filters))).catch((error) => {
      log.warn("couldn't save filters", error);
    });
  };

  const build = (anchor: Element, row: Row): HTMLElement | null => {
    const mounted = row.build(anchor, filters, changed);
    if (!mounted) {
      return null;
    }
    mounted.root.id = row.id;
    mounted.root.classList.add("snp-filter-row");

    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "snp-filter-apply";
    apply.textContent = "Reload to apply";
    apply.addEventListener("click", (event) => {
      event.stopPropagation();
      (options.reloadPage ?? (() => location.reload()))();
    });
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
  };
};
