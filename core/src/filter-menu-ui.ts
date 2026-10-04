import type { ProfileFiltersMenuContract } from "./contracts.js";
import FILTER_MENU_CSS from "./filter-menu.css";
import {
  GENDERS,
  HEIGHT_OPTIONS,
  WEIGHT_OPTIONS,
  allowedGenders,
  rangeKey,
  type Gender,
  type ProfileFilters,
  type RangeFilter,
  type RangeOptions,
} from "./profile-filter.js";
import { PROFILE_TYPE_FILTER_LABEL_SELECTOR } from "./sniffies-selectors.js";

const STYLE_ID = "snp-filter-menu-style";

interface RowBody {
  el: HTMLElement;
  /** Re-reads the filter into the controls. */
  sync: () => void;
}

/** One row we add to Sniffies' Cruisers filter menu. Add an entry to ROWS for a new filter. */
interface Row {
  id: string;
  title: string;
  /** Font Awesome class for the row's leading icon. */
  icon: string;
  filter: (filters: ProfileFilters) => { enabled: boolean };
  /** What the row currently filters for — a different value than at page load needs a reload. */
  key: (filters: ProfileFilters) => string;
  /** Builds the controls under the title. They edit `filters` in place, then call `changed`. */
  body: (filters: ProfileFilters, changed: () => void) => RowBody;
}

// ── Gender: one on/off button per gender ─────────────────────────────────────

const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  nonbinary: "Nonbinary",
  undefined: "Not specified",
};

const genderBody = (filters: ProfileFilters, changed: () => void): RowBody => {
  const el = document.createElement("div");
  el.className = "snp-filter-body";
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
    el.appendChild(button);
    return button;
  });
  return {
    el,
    sync: () => {
      for (const button of buttons) {
        const on = filters.gender.genders.includes(button.dataset.gender as Gender);
        button.classList.toggle("active", on);
        button.setAttribute("aria-pressed", String(on));
      }
    },
  };
};

// ── Height / weight: min and max dropdowns plus a unit switch ────────────────

const rangeBody =
  (pick: (filters: ProfileFilters) => RangeFilter, options: RangeOptions) =>
  (filters: ProfileFilters, changed: () => void): RowBody => {
    const filter = pick(filters);
    const el = document.createElement("div");
    el.className = "snp-filter-body";

    const select = (bound: string): HTMLSelectElement => {
      const node = document.createElement("select");
      node.className = "snp-range-select";
      node.dataset.bound = bound;
      return node;
    };
    const min = select("min");
    const max = select("max");
    const unit = select("unit");
    unit.append(
      new Option(options.imperial.unit, "imperial"),
      new Option(options.metric.unit, "metric"),
    );
    const to = document.createElement("span");
    to.textContent = "to";
    el.append(min, to, max, unit);

    const choices = (): { value: number; label: string }[] =>
      (filter.metric ? options.metric : options.imperial).choices;
    // The stored bounds are in Sniffies' own units (cm/kg); show whichever choice is closest.
    const nearest = (value: number | null): number | null =>
      value === null
        ? null
        : choices().reduce((a, b) =>
            Math.abs(b.value - value) < Math.abs(a.value - value) ? b : a,
          ).value;

    const fill = (): void => {
      const list = choices();
      min.replaceChildren(
        new Option("No min", ""),
        // Sniffies' top value means "or more".
        ...list.map(
          (c, i) => new Option(i === list.length - 1 ? `${c.label} +` : c.label, `${c.value}`),
        ),
      );
      max.replaceChildren(
        new Option("No max", ""),
        ...list.map((c) => new Option(c.label, `${c.value}`)),
      );
    };
    const read = (node: HTMLSelectElement): number | null =>
      node.value === "" ? null : Number(node.value);

    min.addEventListener("change", () => {
      filter.min = read(min);
      if (filter.min !== null && filter.max !== null && filter.min > filter.max) {
        filter.max = filter.min;
      }
      changed();
    });
    max.addEventListener("change", () => {
      filter.max = read(max);
      if (filter.min !== null && filter.max !== null && filter.min > filter.max) {
        filter.min = filter.max;
      }
      changed();
    });
    unit.addEventListener("change", () => {
      filter.metric = unit.value === "metric";
      fill();
      // What's shown is what's applied: move the bounds onto the new unit's choices.
      filter.min = nearest(filter.min);
      filter.max = nearest(filter.max);
      changed();
    });

    fill();
    return {
      el,
      sync: () => {
        unit.value = filter.metric ? "metric" : "imperial";
        min.value = `${nearest(filter.min) ?? ""}`;
        max.value = `${nearest(filter.max) ?? ""}`;
      },
    };
  };

const ROWS: Row[] = [
  {
    id: "snp-gender-filter",
    title: "Gender",
    icon: "fa-venus-mars",
    filter: (f) => f.gender,
    key: (f) => allowedGenders(f.gender).join(),
    body: genderBody,
  },
  {
    id: "snp-height-filter",
    title: "Height",
    icon: "fa-ruler-vertical",
    filter: (f) => f.height,
    key: (f) => rangeKey(f.height),
    body: rangeBody((f) => f.height, HEIGHT_OPTIONS),
  },
  {
    id: "snp-weight-filter",
    title: "Weight",
    icon: "fa-weight",
    filter: (f) => f.weight,
    key: (f) => rangeKey(f.weight),
    body: rangeBody((f) => f.weight, WEIGHT_OPTIONS),
  },
];

/**
 * Adds our filter rows (gender, height, weight) to Sniffies Cruisers filter menu, each with an
 * on/off switch like Sniffies' own rows. Returns a function that removes them again.
 */
export const installProfileFiltersMenu = (options: ProfileFiltersMenuContract): (() => void) => {
  const filters = structuredClone(options.initial);
  // Each mounted row's sync, so a change re-syncs them all (they're rebuilt whenever the menu reopens).
  const syncs = new Map<string, () => void>();

  const changed = (): void => {
    for (const sync of syncs.values()) {
      sync();
    }
    void options.onChange(structuredClone(filters));
  };

  const build = (anchor: Element, row: Row): HTMLElement | null => {
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
    root.id = row.id;
    root.classList.add("snp-filter-row");
    root.classList.remove("last");
    for (const el of root.querySelectorAll("[data-testid]")) {
      el.removeAttribute("data-testid");
    }
    // The clone still points at Sniffies' Profile Type switch — give it its own. Sniffies keeps
    // its switch inputs disabled and drives them from Angular; ours is a plain checkbox.
    toggle.id = `${row.id}-enabled`;
    toggle.disabled = false;
    label.htmlFor = toggle.id;
    label.querySelector("i")?.classList.replace("fa-user", row.icon);
    title.textContent = ` ${row.title}`;

    const body = row.body(filters, changed);
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "snp-filter-apply";
    apply.textContent = "Reload to apply";
    apply.addEventListener("click", () => (options.reloadPage ?? (() => location.reload()))());
    body.el.appendChild(apply);

    const sync = (): void => {
      const { enabled } = row.filter(filters);
      toggle.checked = enabled;
      header?.classList.toggle("active", enabled);
      body.el.classList.toggle("snp-filter-off", !enabled);
      body.sync();
      apply.hidden = row.key(filters) === row.key(options.applied);
    };
    toggle.addEventListener("change", () => {
      row.filter(filters).enabled = toggle.checked;
      changed();
    });

    syncs.set(row.id, sync);
    sync();
    optionsContainer.replaceChildren(body.el);
    return root;
  };

  const render = (): void => {
    if (ROWS.every((row) => document.getElementById(row.id))) {
      return;
    }
    const anchor = document
      .querySelector(PROFILE_TYPE_FILTER_LABEL_SELECTOR)
      ?.closest("filter-type-component");
    if (!anchor) {
      return;
    }
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = FILTER_MENU_CSS;
      document.head.appendChild(style);
    }
    let previous = anchor;
    for (const row of ROWS) {
      const root = document.getElementById(row.id) ?? build(anchor, row);
      if (!root) {
        return;
      }
      if (!root.isConnected) {
        previous.after(root);
      }
      previous = root;
    }
  };

  // The menu only exists in the DOM while open, and Angular rebuilds it each time.
  const observer = new MutationObserver(render);
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
    for (const row of ROWS) {
      document.getElementById(row.id)?.remove();
    }
  };
};
