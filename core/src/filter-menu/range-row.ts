import {
  HEIGHT_OPTIONS,
  rangeKey,
  ownsAnyStat,
  rangeLabel,
  WEIGHT_OPTIONS,
  type ProfileFilters,
  type RangeFilter,
  type RangeOptions,
} from "../profile-filter.js";
import { stripTestIds, type MountedRow, type Row } from "./row.js";
import { openRangeFlyout } from "./flyout.js";
import { ENDOWMENT_FILTER_LABEL_SELECTOR } from "../sniffies-selectors.js";
import { STRINGS } from "../strings.js";

const buildRangeRow =
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
    root.classList.remove("snp-native-hidden");

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
    let wasOn: boolean | null = null;
    // Sniffies shows Cruiser Stats off while all its own stats are, even if we own one that's on.
    const followCruiserStats = (): void => {
      const on = (nativeList?.classList.contains("active") ?? true) || ownsAnyStat(filters);
      if (on === wasOn) {
        return;
      }
      wasOn = on;
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
        followCruiserStats();
        button.style.display = needsReload ? "none" : "";
        label.classList.toggle("active", filter.enabled);
        checkbox.classList.toggle("fa-check-square", filter.enabled);
        checkbox.classList.toggle("fa-square", !filter.enabled);
        statButton.classList.toggle("active", filter.enabled);
        const value = rangeLabel(filter, options);
        button.className = value ? "range" : "select";
        text.classList.toggle("placeholder", !value);
        text.textContent = ` ${value ?? STRINGS.filterMenu.select} `;
      },
    };
  };

const endowmentLine = (): Element | null =>
  document.querySelector(ENDOWMENT_FILTER_LABEL_SELECTOR)?.closest("ui-menu-item-group") ?? null;

export const RANGE_ROWS: Row[] = [
  {
    id: "snp-height-filter",
    anchor: endowmentLine,
    key: (f) => rangeKey(f.height),
    build: buildRangeRow(STRINGS.filterMenu.height, (f) => f.height, HEIGHT_OPTIONS),
  },
  {
    id: "snp-weight-filter",
    anchor: endowmentLine,
    key: (f) => rangeKey(f.weight),
    build: buildRangeRow(STRINGS.filterMenu.weight, (f) => f.weight, WEIGHT_OPTIONS),
  },
];
