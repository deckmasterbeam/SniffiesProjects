export interface GeoOverride {
  enabled: boolean;
  latitude: number;
  longitude: number;
}

export const DEFAULT_GEO_OVERRIDE: GeoOverride = {
  enabled: false,
  latitude: 0,
  longitude: 0,
};

export interface ProfileBorderOpen {
  enabled: boolean;
  openInNewTab: boolean;
}

export const DEFAULT_PROFILE_BORDER_OPEN: ProfileBorderOpen = {
  enabled: false,
  openInNewTab: true,
};

export const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const SETTINGS_KEYS = {
  guid: "guid",
  phone: "phone",
  geoOverride: "geoOverride",
  geoSectionOpen: "geoSectionOpen",
  profileBorderOpen: "profileBorderOpen",
  profileBorderSectionOpen: "profileBorderSectionOpen",
  favoritesEnabled: "favoritesEnabled",
  favoritesSectionOpen: "favoritesSectionOpen",
  sniffiesUserId: "sniffiesUserId",
  blockedBots: "blockedBots",
  blockedBotsFetchedAt: "blockedBotsFetchedAt",
  botBlockingEnabled: "botBlockingEnabled",
  botBlockingSectionOpen: "botBlockingSectionOpen",
} as const;

export interface ExtensionLocalSettings {
  guid: string;
  phone: string;
  geoOverride: GeoOverride;
  geoSectionOpen: boolean;
  profileBorderOpen: ProfileBorderOpen;
  profileBorderSectionOpen: boolean;
  favoritesEnabled: boolean;
  favoritesSectionOpen: boolean;
  sniffiesUserId: string;
  blockedBots: string[];
  blockedBotsFetchedAt: number;
  botBlockingEnabled: boolean;
  botBlockingSectionOpen: boolean;
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
  sniffiesUserId: "",
  blockedBots: [],
  blockedBotsFetchedAt: 0,
  botBlockingEnabled: true,
  botBlockingSectionOpen: false,
};
