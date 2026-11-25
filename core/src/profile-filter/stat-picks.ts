import { CM_PER_INCH } from "../sniffies-api.js";
import { STRINGS } from "../strings.js";
import { type ProfileFilters } from "./filters.js";
import { rangeLabel, type RangeOptions } from "./range.js";

// ── Native stat filters: Position, Body Type, Sexuality, Endowment ───────────
// Sniffies' server applies these, so it never sends profiles that don't list the stat. While a
// stat's "include unlisted" switch is on, we strip it from the outgoing request and match it here.

export const STAT_IDS = ["position", "bodyType", "sexuality", "endowment"] as const;
export type StatId = (typeof STAT_IDS)[number];

/** The key in `filters.CRUISER_STATS.value` (also the `for` of the native row's label). */
export const STAT_KEYS: Record<StatId, string> = {
  position: "sexuality.attitude",
  bodyType: "stats.body",
  sexuality: "sexuality.spectrum",
  endowment: "stats.endowment",
};

/** Endowment pick: cm, as Sniffies has it; `cut` is "cut" or "uncut". */
export interface EndowmentPick {
  min?: number;
  max?: number;
  cut?: string;
}
/** The wheel's top stop, 12 inches or 30 cm, means "and up". */
export const ENDOWMENT_TOP_CM = 30;

export type StatPick = string[] | EndowmentPick;
export type StatPicks = Partial<Record<StatId, StatPick>>;

export type ListStatId = Exclude<StatId, "endowment">;

const options = (labels: Record<string, string>): { value: string; label: string }[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** The values (as Sniffies' API spells them) and labels of the three pick-list stats. */
export const STAT_OPTIONS: Record<ListStatId, { value: string; label: string }[]> = {
  position: options(STRINGS.stats.position),
  bodyType: options(STRINGS.stats.bodyType),
  sexuality: options(STRINGS.stats.sexuality),
};

// What Sniffies offers: 1" to 12" in half inches, or 2cm to 30cm.
export const ENDOWMENT_OPTIONS: RangeOptions = {
  imperial: {
    choices: Array.from({ length: 23 }, (_, i) => {
      const inches = 1 + i / 2;
      return { value: Math.round(inches * CM_PER_INCH), label: STRINGS.range.inches(inches) };
    }),
  },
  metric: {
    choices: Array.from({ length: 29 }, (_, i) => ({
      value: i + 2,
      label: STRINGS.range.cm(i + 2),
    })),
  },
};

export const isEndowmentPick = (value: unknown): value is EndowmentPick =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const hasStatPick = (id: StatId, pick: StatPick | undefined): boolean => {
  if (pick === undefined) {
    return false;
  }
  if (id !== "endowment") {
    return Array.isArray(pick) && pick.length > 0;
  }
  const { min, max, cut } = pick as EndowmentPick;
  return typeof min === "number" || typeof max === "number" || cut === "cut" || cut === "uncut";
};

export const parseStatPicks = (value: unknown): StatPicks => {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const picks: StatPicks = {};
  for (const id of STAT_IDS) {
    const pick = raw[id];
    if (id === "endowment") {
      if (isEndowmentPick(pick)) {
        const { min, max, cut } = pick;
        picks.endowment = {
          ...(typeof min === "number" && { min }),
          ...(typeof max === "number" && { max }),
          ...(typeof cut === "string" && { cut }),
        };
      }
    } else if (Array.isArray(pick)) {
      picks[id] = pick.filter((v): v is string => typeof v === "string");
    }
  }
  return picks;
};

/** What our row's value button reads. */
export const statPickLabel = (id: StatId, pick: StatPick): string => {
  if (id !== "endowment") {
    const labels = new Map(STAT_OPTIONS[id as ListStatId].map((o) => [o.value, o.label]));
    return (pick as string[]).map((value) => labels.get(value) ?? value).join(", ");
  }
  const { min, max, cut } = pick as EndowmentPick;
  const length = rangeLabel({ min: min ?? null, max: max ?? null }, ENDOWMENT_OPTIONS);
  return [length, cut].filter(Boolean).join(", ");
};

/** What a stat's row filters for; different from at page load, it needs a reload. */
export const statKey = (filters: ProfileFilters, id: StatId): string =>
  hasStatPick(id, filters.picks[id])
    ? `${JSON.stringify(filters.picks[id])}${filters.unlisted[id] ? "+unlisted" : ""}`
    : "";

/** Whether any native stat is ours and filtering: Sniffies then shows its own Cruiser Stats off. */
export const ownsAnyStat = (filters: ProfileFilters): boolean =>
  STAT_IDS.some((id) => statKey(filters, id) !== "");

// The last picks Sniffies sent for each stat while it was still the native row's, kept so that
// handing a stat over to our row can start from them. Shared by the page hook and the menu UI.
const NATIVE_PICKS_KEY = "snp-native-stat-picks";

export const loadNativePicks = (): StatPicks => {
  try {
    return parseStatPicks(JSON.parse(localStorage.getItem(NATIVE_PICKS_KEY) ?? "{}"));
  } catch {
    return {};
  }
};

export const saveNativePicks = (picks: StatPicks): void => {
  try {
    localStorage.setItem(NATIVE_PICKS_KEY, JSON.stringify(picks));
  } catch {
    // Storage can be blocked; handing a stat over then starts from nothing.
  }
};

/** Forgets the native pick a stat started from, once our row has taken it. */
export const clearNativePick = (id: StatId): void => {
  const native = loadNativePicks();
  if (native[id] !== undefined) {
    delete native[id];
    saveNativePicks(native);
  }
};
