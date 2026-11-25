import { openMultiFlyout, openRangeFlyout } from "@core/filter-menu/flyout.js";
import { stripTestIds, type MountedRow, type Row } from "@core/filter-menu/row.js";
import {
  clearNativePick,
  hasStatPick,
  isRangeStat,
  loadNativePicks,
  ownsAnyStat,
  RANGE_STAT_OPTIONS,
  rangeKey,
  STAT_IDS,
  STAT_KEYS,
  STAT_OPTIONS,
  statKey,
  statPickLabel,
  type EndowmentPick,
  type ProfileFilters,
  type StatId,
} from "@core/profile-filter.js";
import { STRINGS } from "@core/strings.js";

const nativeStatLine = (id: StatId): Element | null =>
  document.querySelector(`label[for="${STAT_KEYS[id]}"]`)?.closest("ui-menu-item-group") ?? null;

const buildOwnedStatRow =
  (id: StatId) =>
  (anchor: Element, filters: ProfileFilters, changed: () => void): MountedRow | null => {
    const root = anchor.cloneNode(true) as HTMLElement;
    const item = root.querySelector(".list-item");
    const label = root.querySelector("label");
    const checkbox = label?.querySelector("i");
    const name = label?.querySelector("span");
    const statButton = root.querySelector(".stat-button");
    const button = statButton?.querySelector("button");
    const text = button?.querySelector(".text-value");
    if (!item || !label || !checkbox || !name || !statButton || !button || !text) {
      return null;
    }
    stripTestIds(root);
    root.classList.remove("snp-native-hidden");
    label.removeAttribute("for");
    const title = name.textContent?.trim() ?? id;
    const host = root.closest("smart-select-filter") ?? anchor.closest("smart-select-filter");

    const setPick = (pick: unknown): void => {
      (filters.picks as Record<string, unknown>)[id] = pick;
    };
    const emptyPick = (): unknown => (isRangeStat(id) ? {} : []);
    const finish = (pick: unknown, unlisted: boolean): void => {
      filters.unlisted[id] = unlisted;
      setPick(hasStatPick(id, pick as never) ? pick : emptyPick());
      changed();
    };
    // The first time, start from what Sniffies had saved for this stat.
    if (filters.picks[id] === undefined) {
      const seed = loadNativePicks()[id];
      if (seed !== undefined) {
        setPick(seed);
        clearNativePick(id);
        changed();
      }
    }
    const openSheet = (): void => {
      if (!isRangeStat(id)) {
        openMultiFlyout(
          title,
          STAT_OPTIONS[id],
          (filters.picks[id] as string[] | undefined) ?? [],
          filters.unlisted[id],
          finish,
          host,
          checkbox,
        );
        return;
      }
      const current = (filters.picks[id] ?? {}) as EndowmentPick;
      const save = (
        range: { min: number | null; max: number | null; includeUnspecified: boolean },
        cut: string | null,
      ): void =>
        finish(
          {
            ...(range.min !== null && { min: range.min }),
            ...(range.max !== null && { max: range.max }),
            ...(cut !== null && { cut }),
          },
          range.includeUnspecified,
        );
      let range: Parameters<typeof save>[0] | null = null;
      openRangeFlyout(
        title,
        RANGE_STAT_OPTIONS[id],
        {
          min: current.min ?? null,
          max: current.max ?? null,
          includeUnspecified: filters.unlisted[id],
        },
        (next) => {
          range = next;
          if (id !== "endowment") {
            save(next, null);
          }
        },
        host,
        checkbox,
        id === "endowment"
          ? {
              title: STRINGS.filterMenu.cut,
              choices: [
                { value: null, label: STRINGS.range.openEnded },
                { value: "cut", label: STRINGS.filterMenu.cutLabel },
                { value: "uncut", label: STRINGS.filterMenu.uncutLabel },
              ],
              current: current.cut ?? null,
              onDone: (cut) => range && save(range, cut),
            }
          : undefined,
      );
    };

    label.addEventListener("click", (event) => {
      event.preventDefault();
      if (!item.classList.contains("parent-enabled")) {
        return;
      }
      if (hasStatPick(id, filters.picks[id])) {
        setPick(emptyPick());
        changed();
      } else {
        openSheet();
      }
    });
    statButton.addEventListener("click", () => {
      if (item.classList.contains("parent-enabled")) {
        openSheet();
      }
    });
    item.classList.add("parent-enabled");

    return {
      root,
      placeApply: (apply) => button.after(apply),
      sync: (needsReload) => {
        const pick = filters.picks[id];
        const on = hasStatPick(id, pick);
        button.style.display = needsReload ? "none" : "";
        label.classList.toggle("active", on);
        checkbox.classList.toggle("fa-check-square", on);
        checkbox.classList.toggle("fa-square", !on);
        statButton.classList.toggle("active", on);
        text.classList.toggle("placeholder", !on);
        const summary = on ? statPickLabel(id, pick!) : STRINGS.filterMenu.select;
        text.textContent = ` ${on && filters.unlisted[id] ? `${summary}, ${STRINGS.filterMenu.noneListed}` : summary} `;
      },
    };
  };

const ownedStatRow = (id: StatId): Row => ({
  id: `snp-${id}-filter`,
  anchor: () => nativeStatLine(id),
  key: (f) => statKey(f, id),
  build: buildOwnedStatRow(id),
});

export const STAT_ROWS: Row[] = STAT_IDS.map(ownedStatRow);

export const createOwnedSync = (filters: ProfileFilters): (() => void) => {
  const forcedAt = new Map<string, number>();
  let shownOn: HTMLInputElement | null = null;
  return () => {
    const master = document.querySelector<HTMLInputElement>("input#CRUISER_STATS");
    const filtering =
      ownsAnyStat(filters) || rangeKey(filters.height) !== "" || rangeKey(filters.weight) !== "";
    if (master && filtering && !master.checked) {
      master.checked = true;
      shownOn = master;
    } else if (!filtering && shownOn) {
      const native = document.querySelector(".smart-options-container");
      shownOn.checked = native?.classList.contains("active") ?? false;
      shownOn = null;
    }
    for (const id of STAT_IDS) {
      const label = document.querySelector<HTMLElement>(`label[for="${STAT_KEYS[id]}"]`);
      label?.closest("ui-menu-item-group")?.classList.add("snp-native-hidden");
      if (label?.classList.contains("active") && Date.now() - (forcedAt.get(id) ?? 0) > 500) {
        forcedAt.set(id, Date.now());
        label.click();
      }
    }
  };
};
