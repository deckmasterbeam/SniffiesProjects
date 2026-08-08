import {
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_PROFILE_BORDER_OPEN,
  GeoOverride,
  ProfileBorderOpen,
} from "@sniffies-projects/core";

const GEO_STORAGE_KEY = "sniffies-geo";
const PROFILE_BORDER_STORAGE_KEY = "sniffies-profile-border";

export const getGeoOverride = (): GeoOverride => {
  try {
    const raw = localStorage.getItem(GEO_STORAGE_KEY);
    return raw ? { ...DEFAULT_GEO_OVERRIDE, ...JSON.parse(raw) } : { ...DEFAULT_GEO_OVERRIDE };
  } catch {
    return { ...DEFAULT_GEO_OVERRIDE };
  }
};

export const setGeoOverride = (next: GeoOverride): void => {
  localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(next));
};

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
