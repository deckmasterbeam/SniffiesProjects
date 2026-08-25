import {
  DEFAULT_LOCAL_SETTINGS as CORE_DEFAULT_LOCAL_SETTINGS,
  DEFAULT_PROFILE_BORDER_OPEN,
  ExtensionLocalSettings as CoreExtensionLocalSettings,
  GeoOverride,
  PHONE_E164_REGEX,
  ProfileBorderOpen,
  SETTINGS_KEYS as CORE_SETTINGS_KEYS,
} from "@sniffies-projects/core";

export { DEFAULT_PROFILE_BORDER_OPEN, PHONE_E164_REGEX };
export type { ProfileBorderOpen };

export const SETTINGS_KEYS = {
  ...CORE_SETTINGS_KEYS,
  blockedBots: "blockedBots",
  blockedBotsFetchedAt: "blockedBotsFetchedAt",
  botBlockingEnabled: "botBlockingEnabled",
  botBlockingSectionOpen: "botBlockingSectionOpen",
} as const;

export interface ExtensionLocalSettings extends CoreExtensionLocalSettings {
  blockedBots: string[];
  blockedBotsFetchedAt: number;
  botBlockingEnabled: boolean;
  botBlockingSectionOpen: boolean;
}

export const DEFAULT_LOCAL_SETTINGS: ExtensionLocalSettings = {
  ...CORE_DEFAULT_LOCAL_SETTINGS,
  blockedBots: [],
  blockedBotsFetchedAt: 0,
  botBlockingEnabled: true,
  botBlockingSectionOpen: false,
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

export const setSniffiesUserId = async (userId: string): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.sniffiesUserId]: userId });
};

export const setBlockedBots = async (userIds: string[], fetchedAt: number): Promise<void> => {
  await chrome.storage.local.set({
    [SETTINGS_KEYS.blockedBots]: userIds,
    [SETTINGS_KEYS.blockedBotsFetchedAt]: fetchedAt,
  });
};

export const setBotBlockingEnabled = async (enabled: boolean): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.botBlockingEnabled]: enabled });
};
