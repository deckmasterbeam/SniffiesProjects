import type { BotBlockState } from "./contracts.js";
import { createLogger } from "./log.js";
import {
  CM_PER_INCH,
  HEIGHT_LIMITS,
  LB_PER_KG,
  WEIGHT_LIMITS,
  type FilterableProfile,
  type SniffiesGender,
} from "./sniffies-api.js";

export interface ProfileFilterRule {
  name: string;
  isActive: () => boolean;
  hides: (profile: FilterableProfile) => boolean;
  mapOnly?: boolean;
  /** Swallow `userDisconnected` / `userRemoved` frames while active */
  keepsOnMap?: boolean;
  onFiltered?: (ids: string[]) => void;
}

export interface ProfileChecks {
  hidesProfile: (profile: FilterableProfile) => boolean;
  hidesId: (id: string) => boolean;
}

export interface ProfileMatcher extends ProfileChecks {
  isActive: () => boolean;
  keepsOnMap: () => boolean;
  chat: ProfileChecks;
  setSelfId: (id: string) => void;
  /** Applies a partial `userUpdated` profile to the last full one: only its connect time. */
  noteUpdate: (partial: FilterableProfile) => void;
  flush: () => { rule: string; ids: string[] }[];
}

const EXPECTED_PROFILE_PATHS = [
  "data.connectUpdateTime",
  "data.profile.extended.sexuality",
  "data.profile.extended.stats.heightInCm",
  "data.profile.extended.stats.weightInKg",
];

const hasPath = (root: unknown, path: string): boolean => {
  let node = root;
  for (const key of path.split(".")) {
    if (typeof node !== "object" || node === null || !(key in node)) {
      return false;
    }
    node = (node as Record<string, unknown>)[key];
  }
  return true;
};

const log = createLogger("profile-filter");
const reportedGaps = new Set<string>();

const warnIfIncomplete = (profile: FilterableProfile): void => {
  for (const path of EXPECTED_PROFILE_PATHS) {
    if (!reportedGaps.has(path) && !hasPath(profile, path)) {
      reportedGaps.add(path);
      log.warn(
        `profile ${profile._id} has no ${path}; Sniffies may have changed its profile format`,
      );
    }
  }
};

export const createProfileMatcher = (rules: readonly ProfileFilterRule[]): ProfileMatcher => {
  const seen = new Map<string, FilterableProfile>();
  const hidden = new Map<ProfileFilterRule, Set<string>>();
  let selfId = "";

  const hides = (profile: FilterableProfile, inChat: boolean): boolean => {
    if (profile._id === selfId) {
      return false;
    }
    const rule = rules.find((r) => r.isActive() && !(inChat && r.mapOnly) && r.hides(profile));
    if (!rule) {
      return false;
    }
    if (!hidden.has(rule)) {
      hidden.set(rule, new Set());
    }
    hidden.get(rule)!.add(profile._id);
    return true;
  };

  const checks = (inChat: boolean): ProfileChecks => ({
    hidesProfile: (profile) => {
      if (profile.data) {
        warnIfIncomplete(profile);
        seen.set(profile._id, profile);
      }
      return hides(profile, inChat);
    },
    hidesId: (id) => hides(seen.get(id) ?? { _id: id }, inChat),
  });

  return {
    isActive: () => rules.some((r) => r.isActive()),
    keepsOnMap: () => rules.some((r) => r.keepsOnMap && r.isActive()),
    ...checks(false),
    chat: checks(true),
    setSelfId: (id) => {
      selfId = id;
    },
    noteUpdate: ({ _id, data }) => {
      const known = seen.get(_id);
      if (known?.data && data?.connectUpdateTime) {
        seen.set(_id, {
          ...known,
          data: { ...known.data, connectUpdateTime: data.connectUpdateTime },
        });
      }
    },
    flush: () => {
      const result = [...hidden].map(([rule, ids]) => ({ rule, ids: [...ids] }));
      hidden.clear();
      for (const { rule, ids } of result) {
        rule.onFiltered?.(ids);
      }
      return result.map(({ rule, ids }) => ({ rule: rule.name, ids }));
    },
  };
};

// ── Rules ────────────────────────────────────────────────────────────────────

export const botBlockRule = (
  getState: () => BotBlockState,
  onFiltered?: (ids: string[]) => void,
): ProfileFilterRule => ({
  name: "bot-block",
  isActive: () => getState().enabled && getState().blockedIds.size > 0,
  hides: (profile) => getState().blockedIds.has(profile._id),
  onFiltered,
});

export const GENDERS = ["male", "female", "nonbinary", "undefined"] as const;
export type Gender = (typeof GENDERS)[number];

export interface GenderFilter {
  enabled: boolean;
  /** The genders to show while enabled. Never empty. */
  genders: Gender[];
}

export const DEFAULT_GENDER_FILTER: GenderFilter = { enabled: false, genders: [...GENDERS] };

export const parseGenderFilter = (value: unknown): GenderFilter => {
  const raw = (value ?? {}) as { enabled?: unknown; genders?: unknown };
  const { genders } = raw;
  const picked = Array.isArray(genders) ? GENDERS.filter((g) => genders.includes(g)) : [];
  return { enabled: raw.enabled === true, genders: picked.length > 0 ? picked : [...GENDERS] };
};

export const allowedGenders = (filter: GenderFilter): readonly Gender[] =>
  filter.enabled ? filter.genders : GENDERS;

const WIRE_GENDERS: Partial<Record<Exclude<SniffiesGender, null>, Gender>> = {
  man: "male",
  woman: "female",
  nonbinary: "nonbinary",
};

export const profileGender = (profile: FilterableProfile): Gender | null => {
  if (!profile.data) {
    return null;
  }
  const raw = profile.data.profile?.extended?.sexuality?.gender;
  return (raw && WIRE_GENDERS[raw]) || "undefined";
};

export const genderRule = (getFilter: () => GenderFilter): ProfileFilterRule => ({
  name: "gender",
  mapOnly: true,
  isActive: () => {
    const { enabled, genders } = getFilter();
    return enabled && genders.length > 0 && genders.length < GENDERS.length;
  },
  hides: (profile) => {
    const gender = profileGender(profile);
    return gender !== null && !getFilter().genders.includes(gender);
  },
});

// ── Height / weight ──────────────────────────────────────────────────────────

export interface RangeFilter {
  enabled: boolean;
  min: number | null;
  max: number | null;
  metric: boolean;
  /** Also show profiles that don't list the value at all. */
  includeUnspecified: boolean;
}

const prefersMetric = (): boolean =>
  typeof navigator === "undefined" || !/-(US|LR|MM)$/i.test(navigator.language);

const defaultRangeFilter = (): RangeFilter => ({
  enabled: false,
  min: null,
  max: null,
  metric: prefersMetric(),
  includeUnspecified: false,
});

const parseRangeFilter = (value: unknown): RangeFilter => {
  const raw = (value ?? {}) as Partial<Record<keyof RangeFilter, unknown>>;
  const bound = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    enabled: raw.enabled === true,
    min: bound(raw.min),
    max: bound(raw.max),
    metric: typeof raw.metric === "boolean" ? raw.metric : prefersMetric(),
    includeUnspecified: raw.includeUnspecified === true,
  };
};

export const rangeKey = (filter: RangeFilter): string =>
  filter.enabled && (filter.min !== null || filter.max !== null)
    ? `${filter.min ?? ""}-${filter.max ?? ""}${filter.includeUnspecified ? "+unspecified" : ""}`
    : "";

export const rangeRule = (
  name: string,
  getFilter: () => RangeFilter,
  read: (profile: FilterableProfile) => number | null | undefined,
): ProfileFilterRule => ({
  name,
  mapOnly: true,
  isActive: () => rangeKey(getFilter()) !== "",
  hides: (profile) => {
    if (!profile.data) {
      return false;
    }
    const value = read(profile);
    const { min, max, includeUnspecified } = getFilter();
    if (typeof value !== "number") {
      return !includeUnspecified;
    }
    return (min !== null && value < min) || (max !== null && value > max);
  },
});

// ── Last online ──────────────────────────────────────────────────────────────

export interface OnlineFilter {
  enabled: boolean;
  since: number | null;
}

export const DEFAULT_ONLINE_FILTER: OnlineFilter = { enabled: false, since: null };

const parseOnlineFilter = (value: unknown): OnlineFilter => {
  const raw = (value ?? {}) as { enabled?: unknown; since?: unknown };
  const since = typeof raw.since === "number" && isFinite(raw.since) ? raw.since : null;
  return { enabled: raw.enabled === true && since !== null, since };
};

export const onlineKey = (filter: OnlineFilter): string =>
  filter.enabled && filter.since !== null ? String(filter.since) : "";

export const onlineRule = (getFilter: () => OnlineFilter): ProfileFilterRule => ({
  name: "online",
  mapOnly: true,
  keepsOnMap: true,
  isActive: () => onlineKey(getFilter()) !== "",
  hides: (profile) => {
    if (!profile.data) {
      return false;
    }
    // A missing connect time is NaN, it wasn't online recently.
    return !(Date.parse(profile.data.connectUpdateTime ?? "") >= getFilter().since!);
  },
});

export interface RangeChoices {
  unit: string;
  choices: { value: number; label: string }[];
}

export interface RangeOptions {
  imperial: RangeChoices;
  metric: RangeChoices;
}

const steps = (limits: { min: number; max: number }, step: number): number[] => {
  const result: number[] = [];
  for (let n = limits.min; n <= limits.max; n += step) {
    result.push(n);
  }
  return result;
};

export const HEIGHT_OPTIONS: RangeOptions = {
  imperial: {
    unit: "ft",
    choices: steps(HEIGHT_LIMITS.inches, 1).map((inches) => ({
      value: Math.round(inches * CM_PER_INCH),
      label: `${Math.floor(inches / 12)}'${inches % 12}"`,
    })),
  },
  metric: {
    unit: "cm",
    choices: steps(HEIGHT_LIMITS.cm, 1).map((cm) => ({ value: cm, label: `${cm}cm` })),
  },
};

export const WEIGHT_OPTIONS: RangeOptions = {
  imperial: {
    unit: "lb",
    choices: steps(WEIGHT_LIMITS.lb, 5).map((lb) => ({
      value: Math.round(lb / LB_PER_KG),
      label: `${lb}lb`,
    })),
  },
  metric: {
    unit: "kg",
    choices: steps(WEIGHT_LIMITS.kg, 5).map((kg) => ({ value: kg, label: `${kg}kg` })),
  },
};

type RangeChoice = RangeChoices["choices"][number];

export const nearestChoice = (choices: RangeChoice[], value: number): RangeChoice =>
  choices.reduce((a, b) => (Math.abs(b.value - value) < Math.abs(a.value - value) ? b : a));

export const rangeLabel = (filter: RangeFilter, options: RangeOptions): string | null => {
  const { choices } = filter.metric ? options.metric : options.imperial;
  const label = (value: number): string => nearestChoice(choices, value).label;
  if (filter.min !== null && filter.max !== null) {
    return `${label(filter.min)} - ${label(filter.max)}`;
  }
  if (filter.min !== null) {
    return `${label(filter.min)} +`;
  }
  return filter.max !== null ? `Up to ${label(filter.max)}` : null;
};

// ── All the filters the user sets from Sniffies filter menu ─────────────────

export interface ProfileFilters {
  gender: GenderFilter;
  height: RangeFilter;
  weight: RangeFilter;
  online: OnlineFilter;
}

export const DEFAULT_PROFILE_FILTERS: ProfileFilters = {
  gender: DEFAULT_GENDER_FILTER,
  height: defaultRangeFilter(),
  weight: defaultRangeFilter(),
  online: DEFAULT_ONLINE_FILTER,
};

export const parseProfileFilters = (value: unknown): ProfileFilters => {
  const raw = (value ?? {}) as Partial<Record<keyof ProfileFilters, unknown>>;
  return {
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
