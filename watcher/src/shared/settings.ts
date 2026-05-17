export const SETTINGS_KEYS = {
  // TODO: works for a single watcher to track notify timestamps, but if we want to support multiple watchers we need to store this info on and retrieve from the server
  notifyTimestamps: "notifyTimestamps",
  hookSettings: "hookSettings",
} as const;

export interface HookSettings {
  captchaHook: boolean;
  authHook: boolean;
  wsUserIdOverride: string;
  wsLatOverride: string;
  wsLngOverride: string;
}

export const DEFAULT_HOOK_SETTINGS: HookSettings = {
  captchaHook: false,
  authHook: false,
  wsUserIdOverride: "",
  wsLatOverride: "",
  wsLngOverride: "",
};

export const getHookSettings = async (): Promise<HookSettings> => {
  const stored = await chrome.storage.sync.get({ [SETTINGS_KEYS.hookSettings]: DEFAULT_HOOK_SETTINGS });
  return { ...DEFAULT_HOOK_SETTINGS, ...stored[SETTINGS_KEYS.hookSettings] } as HookSettings;
};

export const setHookSettings = async (settings: HookSettings): Promise<void> => {
  await chrome.storage.sync.set({ [SETTINGS_KEYS.hookSettings]: settings });
};

interface WatcherLocalSettings {
  notifyTimestamps: Record<string, number>;
}

const DEFAULT_LOCAL_SETTINGS: WatcherLocalSettings = {
  notifyTimestamps: {},
};

const getLocalSettings = async (): Promise<WatcherLocalSettings> => {
  const stored = await chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS);
  return { ...DEFAULT_LOCAL_SETTINGS, ...stored } as WatcherLocalSettings;
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
