import { openRangeFlyout } from "@core/filter-menu/flyout.js";
import { stripTestIds, type MountedRow, type Row } from "@core/filter-menu/row.js";
import {
  HEIGHT_OPTIONS,
  rangeKey,
  rangeLabel,
  WEIGHT_OPTIONS,
  type ProfileFilters,
  type RangeFilter,
  type RangeOptions,
} from "@core/profile-filter.js";
import { ENDOWMENT_FILTER_LABEL_SELECTOR } from "@core/sniffies-selectors.js";
import { STRINGS } from "@core/strings.js";

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
    // Every native Cruiser Stats line is ours, so Sniffies' own Cruiser Stats switch has no say.
    item.classList.add("parent-enabled");

    label.addEventListener("click", (event) => {
      event.preventDefault();
      if (!filter.enabled && filter.min === null && filter.max === null) {
        openSheet();
        return;
      }
      filter.enabled = !filter.enabled;
      changed();
    });
    statButton.addEventListener("click", openSheet);

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
