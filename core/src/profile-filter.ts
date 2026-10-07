import type { BotBlockState } from "./contracts.js";
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
  onFiltered?: (ids: string[]) => void;
}

export interface ProfileMatcher {
  isActive: () => boolean;
  hidesProfile: (profile: FilterableProfile) => boolean;
  hidesId: (id: string) => boolean;
  setSelfId: (id: string) => void;
  flush: () => { rule: string; ids: string[] }[];
}

export const createProfileMatcher = (rules: readonly ProfileFilterRule[]): ProfileMatcher => {
  const seen = new Map<string, FilterableProfile>();
  const hidden = new Map<ProfileFilterRule, Set<string>>();
  let selfId = "";

  const hides = (profile: FilterableProfile): boolean => {
    if (profile._id === selfId) {
      return false;
    }
    const rule = rules.find((r) => r.isActive() && r.hides(profile));
    if (!rule) {
      return false;
    }
    if (!hidden.has(rule)) {
      hidden.set(rule, new Set());
    }
    hidden.get(rule)!.add(profile._id);
    return true;
  };

  return {
    isActive: () => rules.some((r) => r.isActive()),
    hidesProfile: (profile) => {
      if (profile.data) {
        seen.set(profile._id, profile);
      }
      return hides(profile);
    },
    hidesId: (id) => hides(seen.get(id) ?? { _id: id }),
    setSelfId: (id) => {
      selfId = id;
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
}

const prefersMetric = (): boolean =>
  typeof navigator === "undefined" || !/-(US|LR|MM)$/i.test(navigator.language);

const defaultRangeFilter = (): RangeFilter => ({
  enabled: false,
  min: null,
  max: null,
  metric: prefersMetric(),
});

const parseRangeFilter = (value: unknown): RangeFilter => {
  const raw = (value ?? {}) as Partial<Record<keyof RangeFilter, unknown>>;
  const bound = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    enabled: raw.enabled === true,
    min: bound(raw.min),
    max: bound(raw.max),
    metric: typeof raw.metric === "boolean" ? raw.metric : prefersMetric(),
  };
};

export const rangeKey = (filter: RangeFilter): string =>
  filter.enabled && (filter.min !== null || filter.max !== null)
    ? `${filter.min ?? ""}-${filter.max ?? ""}`
    : "";

export const rangeRule = (
  name: string,
  getFilter: () => RangeFilter,
  read: (profile: FilterableProfile) => number | null | undefined,
): ProfileFilterRule => ({
  name,
  isActive: () => rangeKey(getFilter()) !== "",
  hides: (profile) => {
    if (!profile.data) {
      return false;
    }
    const value = read(profile);
    const { min, max } = getFilter();
    return (
      typeof value !== "number" || (min !== null && value < min) || (max !== null && value > max)
    );
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
}

export const DEFAULT_PROFILE_FILTERS: ProfileFilters = {
  gender: DEFAULT_GENDER_FILTER,
  height: defaultRangeFilter(),
  weight: defaultRangeFilter(),
};

export const parseProfileFilters = (value: unknown): ProfileFilters => {
  const raw = (value ?? {}) as Partial<Record<keyof ProfileFilters, unknown>>;
  return {
    gender: parseGenderFilter(raw.gender),
    height: parseRangeFilter(raw.height),
    weight: parseRangeFilter(raw.weight),
  };
};

export const gateProfileFilters = (filters: ProfileFilters, enabled: boolean): ProfileFilters =>
  enabled
    ? filters
    : {
        gender: { ...filters.gender, enabled: false },
        height: { ...filters.height, enabled: false },
        weight: { ...filters.weight, enabled: false },
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
];
