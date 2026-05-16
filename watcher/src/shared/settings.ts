export const SETTINGS_KEYS = {
  seenEvents: "seenEvents",
  notifyTimestamps: "notifyTimestamps",
} as const;

interface WatcherLocalSettings {
  seenEvents: Record<string, unknown>;
  notifyTimestamps: Record<string, number>;
}

const DEFAULT_LOCAL_SETTINGS: WatcherLocalSettings = {
  seenEvents: {},
  notifyTimestamps: {},
};

const getLocalSettings = async (): Promise<WatcherLocalSettings> => {
  const stored = await chrome.storage.local.get(DEFAULT_LOCAL_SETTINGS);
  return { ...DEFAULT_LOCAL_SETTINGS, ...stored } as WatcherLocalSettings;
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
