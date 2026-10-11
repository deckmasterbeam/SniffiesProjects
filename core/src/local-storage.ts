import { DEFAULT_PROFILE_BORDER_OPEN, type ProfileBorderOpen } from "./settings.js";

// All of core's localStorage keys and their getters/setters live here
const PROFILE_BORDER_STORAGE_KEY = "sniffies-profile-border";
const PROFILE_BORDER_SECTION_OPEN_STORAGE_KEY = "sniffies-profile-border-section-open";

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

export const getProfileBorderSectionOpen = (): boolean => {
  return localStorage.getItem(PROFILE_BORDER_SECTION_OPEN_STORAGE_KEY) === "true";
};

export const setProfileBorderSectionOpen = (open: boolean): void => {
  localStorage.setItem(PROFILE_BORDER_SECTION_OPEN_STORAGE_KEY, String(open));
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
