import {
  CM_PER_INCH,
  HEIGHT_LIMITS,
  LB_PER_KG,
  WEIGHT_LIMITS,
  type FilterableProfile,
} from "../sniffies-api.js";
import { STRINGS } from "../strings.js";
import { type ProfileFilterRule } from "./matcher.js";

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

export const defaultRangeFilter = (): RangeFilter => ({
  enabled: false,
  min: null,
  max: null,
  metric: prefersMetric(),
  includeUnspecified: false,
});

export const parseRangeFilter = (value: unknown): RangeFilter => {
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
    unit: STRINGS.range.units.feet,
    choices: steps(HEIGHT_LIMITS.inches, 1).map((inches) => ({
      value: Math.round(inches * CM_PER_INCH),
      label: STRINGS.range.feetAndInches(Math.floor(inches / 12), inches % 12),
    })),
  },
  metric: {
    unit: STRINGS.range.units.cm,
    choices: steps(HEIGHT_LIMITS.cm, 1).map((cm) => ({ value: cm, label: STRINGS.range.cm(cm) })),
  },
};

export const WEIGHT_OPTIONS: RangeOptions = {
  imperial: {
    unit: STRINGS.range.units.lb,
    choices: steps(WEIGHT_LIMITS.lb, 5).map((lb) => ({
      value: Math.round(lb / LB_PER_KG),
      label: STRINGS.range.lb(lb),
    })),
  },
  metric: {
    unit: STRINGS.range.units.kg,
    choices: steps(WEIGHT_LIMITS.kg, 5).map((kg) => ({ value: kg, label: STRINGS.range.kg(kg) })),
  },
};

type RangeChoice = RangeChoices["choices"][number];

export const nearestChoice = (choices: RangeChoice[], value: number): RangeChoice =>
  choices.reduce((a, b) => (Math.abs(b.value - value) < Math.abs(a.value - value) ? b : a));

export const rangeLabel = (filter: RangeFilter, options: RangeOptions): string | null => {
  const { choices } = filter.metric ? options.metric : options.imperial;
  const label = (value: number): string => nearestChoice(choices, value).label;
  if (filter.min !== null && filter.max !== null) {
    return STRINGS.range.between(label(filter.min), label(filter.max));
  }
  if (filter.min !== null) {
    return STRINGS.range.orMore(label(filter.min));
  }
  return filter.max !== null ? STRINGS.range.upTo(label(filter.max)) : null;
};
