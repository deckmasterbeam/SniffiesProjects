import {
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_PROFILE_BORDER_OPEN,
  ExtensionLocalSettings,
  GeoOverride,
  PHONE_E164_REGEX,
  ProfileBorderOpen,
  SETTINGS_KEYS,
  SNIFFIES_USER_ID_REGEX,
  recordBlockedBotIds,
} from "@sniffies-projects/core";

export {
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_PROFILE_BORDER_OPEN,
  PHONE_E164_REGEX,
  SETTINGS_KEYS,
  SNIFFIES_USER_ID_REGEX,
};
export type { ExtensionLocalSettings, ProfileBorderOpen };

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

export const recordBlockedBotEvent = async (ids: string[]): Promise<void> => {
  const { blockedBotEventsByDay } = await getLocalSettings();
  const next = recordBlockedBotIds(blockedBotEventsByDay, ids);
  await chrome.storage.local.set({ [SETTINGS_KEYS.blockedBotEventsByDay]: next });
};
