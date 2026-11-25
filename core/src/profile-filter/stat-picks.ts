import { type ProfileFilters } from "@core/profile-filter/filters.js";
import { rangeLabel, type RangeOptions } from "@core/profile-filter/range.js";
import { CM_PER_INCH } from "@core/sniffies-api.js";
import { STRINGS } from "@core/strings.js";

// Sniffies' server applies these, so it never sends profiles that don't list the stat. While a
// stat's "include unlisted" switch is on, we strip it from the outgoing request and match it here.

export const STAT_IDS = ["age", "position", "bodyType", "sexuality", "endowment"] as const;
export type StatId = (typeof STAT_IDS)[number];

export const STAT_KEYS: Record<StatId, string> = {
  age: "stats.age",
  position: "sexuality.attitude",
  bodyType: "stats.body",
  sexuality: "sexuality.spectrum",
  endowment: "stats.endowment",
};

export interface RangePick {
  min?: number;
  max?: number;
}

export interface EndowmentPick extends RangePick {
  cut?: string;
}

/** The stats picked as a range, rather than from a list. */
export const RANGE_STAT_IDS = ["age", "endowment"] as const;
export type RangeStatId = (typeof RANGE_STAT_IDS)[number];
export const isRangeStat = (id: StatId): id is RangeStatId =>
  (RANGE_STAT_IDS as readonly string[]).includes(id);

export type StatPick = string[] | EndowmentPick;
export type StatPicks = Partial<Record<StatId, StatPick>>;

export type ListStatId = Exclude<StatId, RangeStatId>;

/** The wheel's top stop of each range, which means "and up". */
export const RANGE_STAT_TOP: Record<RangeStatId, number> = { age: 90, endowment: 30 };

const options = (labels: Record<string, string>): { value: string; label: string }[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const STAT_OPTIONS: Record<ListStatId, { value: string; label: string }[]> = {
  position: options(STRINGS.stats.position),
  bodyType: options(STRINGS.stats.bodyType),
  sexuality: options(STRINGS.stats.sexuality),
};

const AGES = {
  choices: Array.from({ length: RANGE_STAT_TOP.age - 17 }, (_, i) => ({
    value: i + 18,
    label: String(i + 18),
  })),
};

// What Sniffies offers: 1" to 12" in half inches, or 2cm to 30cm.
const ENDOWMENT_OPTIONS: RangeOptions = {
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

export const RANGE_STAT_OPTIONS: Record<RangeStatId, RangeOptions> = {
  age: { imperial: AGES, metric: AGES },
  endowment: ENDOWMENT_OPTIONS,
};

const isPickObject = (value: unknown): value is EndowmentPick =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const hasStatPick = (id: StatId, pick: StatPick | undefined): boolean => {
  if (pick === undefined) {
    return false;
  }
  if (!isRangeStat(id)) {
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
    if (isRangeStat(id)) {
      if (isPickObject(pick)) {
        const { min, max, cut } = pick;
        picks[id] = {
          ...(typeof min === "number" && { min }),
          ...(typeof max === "number" && { max }),
          ...(id === "endowment" && typeof cut === "string" && { cut }),
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
  if (!isRangeStat(id)) {
    const labels = new Map(STAT_OPTIONS[id as ListStatId].map((o) => [o.value, o.label]));
    return (pick as string[]).map((value) => labels.get(value) ?? value).join(", ");
  }
  const { min, max, cut } = pick as EndowmentPick;
  const length = rangeLabel({ min: min ?? null, max: max ?? null }, RANGE_STAT_OPTIONS[id]);
  return [length, cut].filter(Boolean).join(", ");
};

export const statKey = (filters: ProfileFilters, id: StatId): string =>
  hasStatPick(id, filters.picks[id])
    ? `${JSON.stringify(filters.picks[id])}${filters.unlisted[id] ? "+unlisted" : ""}`
    : "";

export const ownsAnyStat = (filters: ProfileFilters): boolean =>
  STAT_IDS.some((id) => statKey(filters, id) !== "");

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

export const clearNativePick = (id: StatId): void => {
  const native = loadNativePicks();
  if (native[id] !== undefined) {
    delete native[id];
    saveNativePicks(native);
  }
};
