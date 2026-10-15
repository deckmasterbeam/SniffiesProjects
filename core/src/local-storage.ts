import {
  DEFAULT_PROFILE_BORDER_OPEN,
  parsePremiumFeatureFlags,
  resolvePremiumFeaturesEnabled,
  type PremiumFeatureFlags,
  type ProfileBorderOpen,
} from "./settings.js";

// All of core's localStorage keys and their getters/setters live here
const PROFILE_BORDER_STORAGE_KEY = "sniffies-profile-border";

export const getProfileBorderOpen = (): ProfileBorderOpen => {
  try {
    const raw = localStorage.getItem(PROFILE_BORDER_STORAGE_KEY);
    return raw
      ? { ...DEFAULT_PROFILE_BORDER_OPEN, ...JSON.parse(raw) }
      : { ...DEFAULT_PROFILE_BORDER_OPEN };
  } catch {
    return { ...DEFAULT_PROFILE_BORDER_OPEN };
  }
};

export const setProfileBorderOpen = (next: ProfileBorderOpen): void => {
  localStorage.setItem(PROFILE_BORDER_STORAGE_KEY, JSON.stringify(next));
};

const PROFILE_FILTERS_ENABLED_STORAGE_KEY = "sniffies-profile-filters-enabled";
const PROFILE_FILTERS_SECTION_OPEN_STORAGE_KEY = "sniffies-profile-filters-section-open";

export const getProfileFiltersEnabled = (): boolean => {
  return localStorage.getItem(PROFILE_FILTERS_ENABLED_STORAGE_KEY) === "true";
};

export const setProfileFiltersEnabled = (enabled: boolean): void => {
  localStorage.setItem(PROFILE_FILTERS_ENABLED_STORAGE_KEY, String(enabled));
};

export const getProfileFiltersSectionOpen = (): boolean => {
  return localStorage.getItem(PROFILE_FILTERS_SECTION_OPEN_STORAGE_KEY) === "true";
};

export const setProfileFiltersSectionOpen = (open: boolean): void => {
  localStorage.setItem(PROFILE_FILTERS_SECTION_OPEN_STORAGE_KEY, String(open));
};

const PREMIUM_FEATURES_ENABLED_STORAGE_KEY = "sniffies-premium-features-enabled";
const GEO_STORAGE_KEY = "sniffies-geo";

const readLegacyEnabled = (key: string): boolean | undefined => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? Boolean(JSON.parse(raw)?.enabled) : undefined;
  } catch {
    return undefined;
  }
};

export const getPremiumFeaturesEnabled = (): boolean => {
  const raw = localStorage.getItem(PREMIUM_FEATURES_ENABLED_STORAGE_KEY);
  return resolvePremiumFeaturesEnabled(
    raw === null ? undefined : raw === "true",
    readLegacyEnabled(GEO_STORAGE_KEY),
    readLegacyEnabled(PROFILE_BORDER_STORAGE_KEY),
  );
};

export const setPremiumFeaturesEnabled = (enabled: boolean): void => {
  localStorage.setItem(PREMIUM_FEATURES_ENABLED_STORAGE_KEY, String(enabled));
};

const PREMIUM_FLAGS_STORAGE_KEY = "sniffies-premium-feature-flags";

export const getPremiumFeatureFlags = (): PremiumFeatureFlags => {
  try {
    return parsePremiumFeatureFlags(JSON.parse(localStorage.getItem(PREMIUM_FLAGS_STORAGE_KEY)!));
  } catch {
    return parsePremiumFeatureFlags(null);
  }
};

export const setPremiumFeatureFlags = (flags: PremiumFeatureFlags): void => {
  localStorage.setItem(PREMIUM_FLAGS_STORAGE_KEY, JSON.stringify(flags));
};

const PREMIUM_SECTION_OPEN_STORAGE_KEY = "sniffies-premium-section-open";
const HAS_PLUS_STORAGE_KEY = "sniffies-has-plus";

export const getPremiumSectionOpen = (): boolean => {
  return localStorage.getItem(PREMIUM_SECTION_OPEN_STORAGE_KEY) === "true";
};

export const setPremiumSectionOpen = (open: boolean): void => {
  localStorage.setItem(PREMIUM_SECTION_OPEN_STORAGE_KEY, String(open));
};

export const getHasPlus = (): boolean | null => {
  const raw = localStorage.getItem(HAS_PLUS_STORAGE_KEY);
  return raw === null ? null : raw === "true";
};

export const setHasPlus = (hasPlus: boolean): void => {
  localStorage.setItem(HAS_PLUS_STORAGE_KEY, String(hasPlus));
};
