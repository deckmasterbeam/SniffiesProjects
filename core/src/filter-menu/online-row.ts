import { openChoiceFlyout } from "@core/filter-menu/flyout.js";
import { stripTestIds, type MountedRow, type Row } from "@core/filter-menu/row.js";
import {
  clockText,
  ONLINE_MINUTES,
  onlineKey,
  onlineLabel,
  onlineSinceLabel,
  type ProfileFilters,
} from "@core/profile-filter.js";
import { CONNECTED_NOW_FILTER_LABEL_SELECTOR } from "@core/sniffies-selectors.js";
import { STRINGS } from "@core/strings.js";

const PAGE_LOADED_AT = Date.now();

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
  title.textContent = ` ${STRINGS.filterMenu.onlineAfter}`;
  // The cutoff, under the title.
  const since = document.createElement("p");
  since.className = "snp-online-since";
  titleLine.after(since);

  const turnOffCruisingNow = (): void => {
    const native = cruisingNowRow();
    if (native?.querySelector<HTMLInputElement>("#CONNECTED_NOW")?.checked) {
      native.querySelector<HTMLElement>(".list-item-level-2")?.click();
    }
  };

  const openPicker = (): void => {
    const now = Date.now();
    openChoiceFlyout(
      STRINGS.filterMenu.onlineAfter,
      // Static shows the time each option works out to now.
      (mode) =>
        ONLINE_MINUTES.map((value) => ({
          value,
          label:
            mode === "static"
              ? `${onlineLabel(value)} (${clockText(now - value * 60_000, now)})`
              : onlineLabel(value),
        })),
      filters.online.minutes,
      (minutes, mode) => {
        filters.online = {
          enabled: true,
          minutes,
          pickedAt: Date.now(),
          ...(mode === "static" && { cutoff: Date.now() - minutes * 60_000 }),
        };
        turnOffCruisingNow();
        changed();
      },
      root.closest("smart-select-filter"),
      {
        current: filters.online.cutoff === undefined ? "rolling" : "static",
        choices: [
          { value: "rolling", label: STRINGS.filterMenu.rolling },
          { value: "static", label: STRINGS.filterMenu.static },
        ],
      },
    );
  };

  toggle.addEventListener("change", () => {
    if (filters.online.minutes === null) {
      toggle.checked = false;
      openPicker();
      return;
    }
    filters.online.enabled = toggle.checked;
    if (toggle.checked) {
      turnOffCruisingNow();
    }
    changed();
  });

  label.addEventListener("click", (event) => {
    event.preventDefault();
    openPicker();
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
      header.classList.toggle("active", on);
      // The applied cutoff is fixed at page load; a pending pick counts back from when it was made.
      const from = needsReload ? (filters.online.pickedAt ?? Date.now()) : PAGE_LOADED_AT;
      const { cutoff } = filters.online;
      since.textContent = !on
        ? ""
        : cutoff === undefined
          ? onlineSinceLabel(minutes, from)
          : STRINGS.filterMenu.cruisersOnlineAfter(clockText(cutoff, Date.now()));
      since.style.display = on ? "" : "none";
    },
  };
};

export const cruisingNowRow = (): Element | null =>
  document.querySelector(CONNECTED_NOW_FILTER_LABEL_SELECTOR)?.closest("ui-list-item-level-2") ??
  null;

export const ONLINE_ROW: Row = {
  id: ONLINE_ROW_ID,
  anchor: cruisingNowRow,
  key: (f) => (onlineKey(f.online) ? `${onlineKey(f.online)}@${f.online.pickedAt ?? ""}` : ""),
  build: buildOnlineRow,
};
