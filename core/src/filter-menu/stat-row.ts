import {
  clearNativePick,
  ENDOWMENT_OPTIONS,
  hasStatPick,
  loadNativePicks,
  ownsAnyStat,
  STAT_IDS,
  STAT_KEYS,
  STAT_OPTIONS,
  statKey,
  statPickLabel,
  type EndowmentPick,
  type ProfileFilters,
  type StatId as OwnedStatId,
} from "../profile-filter.js";
import { stripTestIds, type MountedRow, type Row } from "./row.js";
import { openMultiFlyout, openRangeFlyout } from "./flyout.js";
import { STRINGS } from "../strings.js";

// ── Position / Body Type / Sexuality / Endowment ──
// Sniffies' own rows for these are hidden and forced off, and these rows stand in for them: it
// filters the map in the browser too, and hides anyone with no value for a stat it has on, which
// would make "include profiles with none listed" impossible.

const nativeStatLine = (id: OwnedStatId): Element | null =>
  document.querySelector(`label[for="${STAT_KEYS[id]}"]`)?.closest("ui-menu-item-group") ?? null;

const buildOwnedStatRow =
  (id: OwnedStatId) =>
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

    // Cleared, not removed: no pick at all is what lets Sniffies' old pick start the row off.
    const emptyPick = (): unknown => (id === "endowment" ? {} : []);
    const clear = (): void => {
      (filters.picks as Record<string, unknown>)[id] = emptyPick();
      changed();
    };
    const finish = (pick: unknown, unlisted: boolean): void => {
      filters.unlisted[id] = unlisted;
      (filters.picks as Record<string, unknown>)[id] = hasStatPick(id, pick as never)
        ? pick
        : emptyPick();
      changed();
    };
    // The first time, start from what Sniffies had saved for this stat.
    if (filters.picks[id] === undefined) {
      const seed = loadNativePicks()[id];
      if (seed !== undefined) {
        (filters.picks as Record<string, unknown>)[id] = seed;
        clearNativePick(id);
        changed();
      }
    }
    const openSheet = (): void => {
      if (id !== "endowment") {
        openMultiFlyout(
          title,
          STAT_OPTIONS[id],
          (filters.picks[id] as string[] | undefined) ?? [],
          filters.unlisted[id],
          (values, include) => finish(values, include),
          host,
          checkbox,
        );
        return;
      }
      const current = (filters.picks.endowment ?? {}) as EndowmentPick;
      let range: { min: number | null; max: number | null; includeUnspecified: boolean } | null =
        null;
      openRangeFlyout(
        title,
        ENDOWMENT_OPTIONS,
        {
          min: current.min ?? null,
          max: current.max ?? null,
          metric: false,
          includeUnspecified: filters.unlisted.endowment,
        },
        (next) => {
          range = next;
        },
        host,
        checkbox,
        {
          title: STRINGS.filterMenu.cut,
          choices: [
            { value: null, label: STRINGS.range.openEnded },
            { value: "cut", label: STRINGS.filterMenu.cutLabel },
            { value: "uncut", label: STRINGS.filterMenu.uncutLabel },
          ],
          current: current.cut ?? null,
          onDone: (cut) => {
            const picked = range;
            if (!picked) {
              return;
            }
            finish(
              {
                ...(picked.min !== null && { min: picked.min }),
                ...(picked.max !== null && { max: picked.max }),
                ...(cut !== null && { cut }),
              },
              picked.includeUnspecified,
            );
          },
        },
      );
    };

    label.addEventListener("click", (event) => {
      event.preventDefault();
      if (!item.classList.contains("parent-enabled")) {
        return;
      }
      if (hasStatPick(id, filters.picks[id])) {
        clear();
      } else {
        openSheet();
      }
    });
    statButton.addEventListener("click", () => {
      if (item.classList.contains("parent-enabled")) {
        openSheet();
      }
    });
    // Sniffies turns its Cruiser Stats switch off once none of *its* stats is on, which is always
    // so for the ones we've taken over, so this row doesn't follow that switch.
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

const ownedStatRow = (id: OwnedStatId): Row => ({
  id: `snp-${id}-filter`,
  anchor: () => nativeStatLine(id),
  key: (f) => statKey(f, id),
  build: buildOwnedStatRow(id),
});

export const STAT_ROWS: Row[] = STAT_IDS.map(ownedStatRow);

// Their native rows are hidden and forced off, so Sniffies' own check of the map (which hides
// anyone with no value for an enabled stat) never sees them.
export const createOwnedSync = (filters: ProfileFilters): (() => void) => {
  const forcedAt = new Map<string, number>();
  let shownOn: HTMLInputElement | null = null;
  return () => {
    // With its own stats all off, Sniffies shows the Cruiser Stats switch off. We're still
    // filtering on stats, so show it on while one of ours is, and put it back afterwards.
    const master = document.querySelector<HTMLInputElement>("input#CRUISER_STATS");
    const filtering = ownsAnyStat(filters);
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
