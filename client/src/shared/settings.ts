export const SETTINGS_KEYS = {
  guid: "guid",
  phone: "phone",
  geoOverride: "geoOverride",
  geoSectionOpen: "geoSectionOpen",
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

export interface ExtensionLocalSettings {
  guid: string;
  phone: string;
  geoOverride: GeoOverride;
  geoSectionOpen: boolean;
}

export const DEFAULT_LOCAL_SETTINGS: ExtensionLocalSettings = {
  guid: "",
  phone: "",
  geoOverride: DEFAULT_GEO_OVERRIDE,
  geoSectionOpen: false,
};

export const getLocalSettings = async (): Promise<ExtensionLocalSettings> => {
  const stored = await chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS);
  return { ...DEFAULT_LOCAL_SETTINGS, ...stored } as ExtensionLocalSettings;
};

export const setGeoOverride = async (next: GeoOverride): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.geoOverride]: next });
};
