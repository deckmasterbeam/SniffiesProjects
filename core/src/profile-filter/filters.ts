import { STAT_IDS, type StatId, type StatPicks, parseStatPicks } from "./stat-picks.js";
import { statTakeover } from "./stat-takeover.js";
import {
  type GenderFilter,
  DEFAULT_GENDER_FILTER,
  parseGenderFilter,
  genderRule,
} from "./gender.js";
import {
  type OnlineFilter,
  DEFAULT_ONLINE_FILTER,
  parseOnlineFilter,
  onlineRule,
} from "./online.js";
import { type ProfileFilterRule } from "./matcher.js";
import { type RangeFilter, defaultRangeFilter, parseRangeFilter, rangeRule } from "./range.js";

// ── All the filters the user sets from Sniffies filter menu ─────────────────

export interface ProfileFilters {
  /** Per native stat: also show profiles that don't list it (see `statTakeover`). */
  unlisted: Record<StatId, boolean>;
  /**
   * Per native stat: what to show, set from our own row. Sniffies' native rows for these stats are
   * hidden and forced off, so these are matched here instead. Empty (but present) once cleared.
   */
  picks: StatPicks;
  gender: GenderFilter;
  height: RangeFilter;
  weight: RangeFilter;
  online: OnlineFilter;
}

export const DEFAULT_PROFILE_FILTERS: ProfileFilters = {
  unlisted: { position: false, bodyType: false, sexuality: false, endowment: false },
  picks: {},
  gender: DEFAULT_GENDER_FILTER,
  height: defaultRangeFilter(),
  weight: defaultRangeFilter(),
  online: DEFAULT_ONLINE_FILTER,
};

export const parseProfileFilters = (value: unknown): ProfileFilters => {
  const raw = (value ?? {}) as Partial<Record<keyof ProfileFilters, unknown>>;
  const unlisted = (raw.unlisted ?? {}) as Partial<Record<StatId, unknown>>;
  return {
    unlisted: Object.fromEntries(STAT_IDS.map((id) => [id, unlisted[id] === true])) as Record<
      StatId,
      boolean
    >,
    picks: parseStatPicks(raw.picks),
    gender: parseGenderFilter(raw.gender),
    height: parseRangeFilter(raw.height),
    weight: parseRangeFilter(raw.weight),
    online: parseOnlineFilter(raw.online),
  };
};

export const gateProfileFilters = (filters: ProfileFilters, enabled: boolean): ProfileFilters =>
  enabled
    ? filters
    : {
        unlisted: DEFAULT_PROFILE_FILTERS.unlisted,
        picks: {},
        gender: { ...filters.gender, enabled: false },
        height: { ...filters.height, enabled: false },
        weight: { ...filters.weight, enabled: false },
        online: { ...filters.online, enabled: false },
      };

export const profileFilterRules = (getFilters: () => ProfileFilters): ProfileFilterRule[] => [
  genderRule(() => getFilters().gender),
  rangeRule(
    "height",
    () => getFilters().height,
    (profile) => profile.data?.profile?.extended?.stats?.heightInCm,
  ),
  rangeRule(
    "weight",
    () => getFilters().weight,
    (profile) => profile.data?.profile?.extended?.stats?.weightInKg,
  ),
  onlineRule(() => getFilters().online),
];

// The page hook can't wait for the extension's message before its first request, so the
// extension also leaves the filters it applied here, where the hook can read them straight away.
const FILTERS_MIRROR_KEY = "snp-applied-profile-filters";

export const saveFiltersMirror = (filters: ProfileFilters, enabled: boolean): void => {
  try {
    localStorage.setItem(FILTERS_MIRROR_KEY, JSON.stringify({ enabled, filters }));
  } catch {
    // Storage can be blocked; the hook then waits for the extension's message as before.
  }
};

export const loadFiltersMirror = (): { filters: ProfileFilters; enabled: boolean } => {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTERS_MIRROR_KEY) ?? "null") as {
      enabled?: unknown;
      filters?: unknown;
    } | null;
    return { enabled: raw?.enabled === true, filters: parseProfileFilters(raw?.filters) };
  } catch {
    return { enabled: false, filters: parseProfileFilters(null) };
  }
};
