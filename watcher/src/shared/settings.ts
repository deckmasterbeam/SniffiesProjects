export const SETTINGS_KEYS = {
  favorites: "favorites",
  notify: "notify",
  notifyTimestamps: "notifyTimestamps",
  seenEvents: "seenEvents",
} as const;

export interface NotifySettings {
  phone: string;
  endpoint: string;
  secret: string;
}

export interface FavoriteEntry {
  favoritedAt: number;
  profilePicUrl: string | null;
}

export type FavoritesMap = Record<string, FavoriteEntry>;

export const DEFAULT_NOTIFY: NotifySettings = {
  phone: "",
  endpoint: "",
  secret: "",
};

interface WatcherLocalSettings {
  favorites: FavoritesMap;
  notify: NotifySettings;
  notifyTimestamps: Record<string, number>;
  seenEvents: Record<string, unknown>;
}

const DEFAULT_LOCAL_SETTINGS: WatcherLocalSettings = {
  favorites: {},
  notify: DEFAULT_NOTIFY,
  notifyTimestamps: {},
  seenEvents: {},
};

export const getLocalSettings = async (): Promise<WatcherLocalSettings> => {
  const stored = await chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS);
  return { ...DEFAULT_LOCAL_SETTINGS, ...stored } as WatcherLocalSettings;
};

export const getFavorites = async (): Promise<FavoritesMap> => {
  const { favorites } = await getLocalSettings();
  return favorites;
};

export const getNotify = async (): Promise<NotifySettings> => {
  const { notify } = await getLocalSettings();
  return { ...DEFAULT_NOTIFY, ...notify };
};

export const recordSeenEvent = async (eventName: string, data: unknown): Promise<void> => {
  const { seenEvents } = await getLocalSettings();
  if (Object.prototype.hasOwnProperty.call(seenEvents, eventName)) return;
  await chrome.storage.local.set({
    [SETTINGS_KEYS.seenEvents]: { ...seenEvents, [eventName]: data },
  });
};

export const getNotifyTimestamp = async (userId: string): Promise<number> => {
  const { notifyTimestamps } = await getLocalSettings();
  return notifyTimestamps[userId] ?? 0;
};

export const setNotifyTimestamp = async (userId: string, ts: number): Promise<void> => {
  const { notifyTimestamps } = await getLocalSettings();
  await chrome.storage.local.set({
    [SETTINGS_KEYS.notifyTimestamps]: { ...notifyTimestamps, [userId]: ts },
  });
};

export const clearNotifyTimestamp = async (userId: string): Promise<void> => {
  const { notifyTimestamps } = await getLocalSettings();
  const next = { ...notifyTimestamps };
  delete next[userId];
  await chrome.storage.local.set({ [SETTINGS_KEYS.notifyTimestamps]: next });
};
