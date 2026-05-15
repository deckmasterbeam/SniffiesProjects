// Shared settings keys and helpers backed by chrome.storage.local.

export const SETTINGS_KEYS = {
  debug: "debug",
  favorites: "favorites",
  notify: "notify",
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

export interface ExtensionLocalSettings {
  debug: boolean;
  favorites: FavoritesMap;
  notify: NotifySettings;
}

export const DEFAULT_NOTIFY: NotifySettings = {
  phone: "",
  endpoint: "",
  secret: "",
};

export const DEFAULT_LOCAL_SETTINGS: ExtensionLocalSettings = {
  debug: false,
  favorites: {},
  notify: DEFAULT_NOTIFY,
};

export const getLocalSettings = async (): Promise<ExtensionLocalSettings> => {
  const stored = await chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS);
  return { ...DEFAULT_LOCAL_SETTINGS, ...stored } as ExtensionLocalSettings;
};

export const setDebug = async (debug: boolean): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.debug]: debug });
};

export const getFavorites = async (): Promise<FavoritesMap> => {
  const { favorites } = await getLocalSettings();
  return favorites;
};

export const setFavorite = async (
  userId: string,
  favorite: boolean,
  profilePicUrl: string | null = null,
): Promise<FavoritesMap> => {
  const current = await getFavorites();
  const next: FavoritesMap = { ...current };
  if (favorite) {
    next[userId] = { favoritedAt: Date.now(), profilePicUrl };
  } else {
    delete next[userId];
  }
  await chrome.storage.local.set({ [SETTINGS_KEYS.favorites]: next });
  return next;
};

export const getNotify = async (): Promise<NotifySettings> => {
  const { notify } = await getLocalSettings();
  return { ...DEFAULT_NOTIFY, ...notify };
};

export const setNotify = async (next: NotifySettings): Promise<void> => {
  await chrome.storage.local.set({ [SETTINGS_KEYS.notify]: next });
};
