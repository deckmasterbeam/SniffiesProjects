import {
  type GenderFilter,
  DEFAULT_GENDER_FILTER,
  genderRule,
  parseGenderFilter,
} from "./gender.js";
import { type ProfileFilterRule } from "./matcher.js";
import {
  type OnlineFilter,
  DEFAULT_ONLINE_FILTER,
  onlineRule,
  parseOnlineFilter,
} from "./online.js";
import { type RangeFilter, defaultRangeFilter, parseRangeFilter, rangeRule } from "./range.js";
import { type StatId, type StatPicks, parseStatPicks, STAT_IDS } from "./stat-picks.js";

// ── All the filters the user sets from Sniffies filter menu ─────────────────

export interface ProfileFilters {
  unlisted: Record<StatId, boolean>;
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
