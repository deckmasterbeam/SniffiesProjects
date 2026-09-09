import type { BlockedBotDailyLog } from "./blocked-bot-log.js";

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

// Sniffies user ids are 24-character hex Mongo ObjectIds (confirmed via HAR).
export const SNIFFIES_USER_ID_REGEX = /^[a-f0-9]{24}$/i;

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
  blockedBotEventsByDay: "blockedBotEventsByDay",
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
  blockedBotEventsByDay: BlockedBotDailyLog;
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
  blockedBotEventsByDay: {},
};
