import type { BlockedBotDailyLog } from "./blocked-bot-log.js";
import { DEFAULT_PROFILE_FILTERS, type ProfileFilters } from "./profile-filter.js";

export interface GeoOverride {
  enabled: boolean;
  latitude: number;
  longitude: number;
  label?: string;
}

export const DEFAULT_GEO_OVERRIDE: GeoOverride = {
  enabled: false,
  latitude: 0,
  longitude: 0,
};

/** True once a real location has been captured — (0, 0) is the "nothing picked yet" sentinel. */
export const hasCapturedCoords = (override: GeoOverride): boolean =>
  override.latitude !== 0 || override.longitude !== 0;

export interface ProfileBorderOpen {
  enabled: boolean;
  openInNewTab: boolean;
}

export const DEFAULT_PROFILE_BORDER_OPEN: ProfileBorderOpen = {
  enabled: false,
  openInNewTab: true,
};

export interface PremiumFeatureFlags {
  location: boolean;
  boundary: boolean;
  photos: boolean;
}

export const DEFAULT_PREMIUM_FEATURE_FLAGS: PremiumFeatureFlags = {
  location: true,
  boundary: true,
  photos: true,
};

export const parsePremiumFeatureFlags = (value: unknown): PremiumFeatureFlags => {
  const raw = (value ?? {}) as Partial<Record<keyof PremiumFeatureFlags, unknown>>;
  return {
    location: raw.location !== false,
    boundary: raw.boundary !== false,
    photos: raw.photos !== false,
  };
};

export const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

// Sniffies user ids are 24-character hex Mongo ObjectIds (confirmed via HAR).
export const SNIFFIES_USER_ID_REGEX = /^[a-f0-9]{24}$/i;

export const SETTINGS_KEYS = {
  guid: "guid",
  phone: "phone",
  geoOverride: "geoOverride",
  profileBorderOpen: "profileBorderOpen",
  premiumSectionOpen: "premiumSectionOpen",
  favoritesEnabled: "favoritesEnabled",
  favoritesSectionOpen: "favoritesSectionOpen",
  sniffiesUserId: "sniffiesUserId",
  blockedBots: "blockedBots",
  blockedBotsFetchedAt: "blockedBotsFetchedAt",
  botBlockingEnabled: "botBlockingEnabled",
  botBlockingSectionOpen: "botBlockingSectionOpen",
  blockedBotEventsByDay: "blockedBotEventsByDay",
  profileFilters: "profileFilters",
  profileFiltersEnabled: "profileFiltersEnabled",
  profileFiltersSectionOpen: "profileFiltersSectionOpen",
  hasPlus: "hasPlus",
  premiumFeaturesEnabled: "premiumFeaturesEnabled",
  premiumFeatureFlags: "premiumFeatureFlags",
} as const;

export interface ExtensionLocalSettings {
  guid: string;
  phone: string;
  geoOverride: GeoOverride;
  profileBorderOpen: ProfileBorderOpen;
  premiumSectionOpen: boolean;
  favoritesEnabled: boolean;
  favoritesSectionOpen: boolean;
  sniffiesUserId: string;
  blockedBots: string[];
  blockedBotsFetchedAt: number;
  botBlockingEnabled: boolean;
  botBlockingSectionOpen: boolean;
  blockedBotEventsByDay: BlockedBotDailyLog;
  profileFilters: ProfileFilters;
  profileFiltersEnabled: boolean;
  profileFiltersSectionOpen: boolean;
  hasPlus: boolean | null;
  premiumFeaturesEnabled: boolean;
  premiumFeatureFlags: PremiumFeatureFlags;
}

export const DEFAULT_LOCAL_SETTINGS: ExtensionLocalSettings = {
  guid: "",
  phone: "",
  geoOverride: DEFAULT_GEO_OVERRIDE,
  profileBorderOpen: DEFAULT_PROFILE_BORDER_OPEN,
  premiumSectionOpen: false,
  favoritesEnabled: false,
  favoritesSectionOpen: false,
  sniffiesUserId: "",
  blockedBots: [],
  blockedBotsFetchedAt: 0,
  botBlockingEnabled: true,
  botBlockingSectionOpen: false,
  blockedBotEventsByDay: {},
  profileFilters: DEFAULT_PROFILE_FILTERS,
  profileFiltersEnabled: false,
  profileFiltersSectionOpen: false,
  hasPlus: null,
  premiumFeaturesEnabled: true,
  premiumFeatureFlags: DEFAULT_PREMIUM_FEATURE_FLAGS,
};
