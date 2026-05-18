export const SETTINGS_KEYS = {
  guid: "guid",
  phone: "phone",
  geoOverride: "geoOverride",
  geoSectionOpen: "geoSectionOpen",
  profileBorderOpen: "profileBorderOpen",
  profileBorderSectionOpen: "profileBorderSectionOpen",
  favoritesEnabled: "favoritesEnabled",
  favoritesSectionOpen: "favoritesSectionOpen",
} as const;

export const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

export interface GeoOverride {
  enabled: boolean;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const DEFAULT_GEO_OVERRIDE: GeoOverride = {
  enabled: false,
  latitude: 0,
  longitude: 0,
  accuracy: 10,
};

export interface ProfileBorderOpen {
  enabled: boolean;
  openInNewTab: boolean;
}

export const DEFAULT_PROFILE_BORDER_OPEN: ProfileBorderOpen = {
  enabled: false,
  openInNewTab: true,
};

export interface ExtensionLocalSettings {
  guid: string;
  phone: string;
  geoOverride: GeoOverride;
  geoSectionOpen: boolean;
  profileBorderOpen: ProfileBorderOpen;
  profileBorderSectionOpen: boolean;
  favoritesEnabled: boolean;
  favoritesSectionOpen: boolean;
}

export const DEFAULT_LOCAL_SETTINGS: ExtensionLocalSettings = {
  guid: "",
  phone: "",
  geoOverride: DEFAULT_GEO_OVERRIDE,
  geoSectionOpen: false,
  profileBorderOpen: DEFAULT_PROFILE_BORDER_OPEN,
  profileBorderSectionOpen: false,
  favoritesEnabled: false,
  favoritesSectionOpen: false,
};

export const getLocalSettings = async (): Promise<ExtensionLocalSettings> => {
  const stored = await chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS);
  return { ...DEFAULT_LOCAL_SETTINGS, ...stored } as ExtensionLocalSettings;
};

export const setGeoOverride = async (next: GeoOverride): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.geoOverride]: next });
};

export const setProfileBorderOpen = async (next: ProfileBorderOpen): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.profileBorderOpen]: next });
};

export const setFavoritesEnabled = async (enabled: boolean): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.favoritesEnabled]: enabled });
};
