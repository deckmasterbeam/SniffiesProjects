import {
  BlockedBotDailyLog,
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_PROFILE_BORDER_OPEN,
  GeoOverride,
  ProfileBorderOpen,
  recordBlockedBotIds,
} from "@sniffies-projects/core";

const GEO_STORAGE_KEY = "sniffies-geo";
const PROFILE_BORDER_STORAGE_KEY = "sniffies-profile-border";
const BLOCKED_BOTS_STORAGE_KEY = "sniffies-blocked-bots";
const BLOCKED_BOTS_FETCHED_AT_STORAGE_KEY = "sniffies-blocked-bots-fetched-at";
const BOT_BLOCKING_ENABLED_STORAGE_KEY = "sniffies-bot-blocking-enabled";
const BOT_BLOCKING_SECTION_OPEN_STORAGE_KEY = "sniffies-bot-blocking-section-open";
const BLOCKED_BOT_EVENTS_STORAGE_KEY = "sniffies-blocked-bot-events";

export const getGeoOverride = (): GeoOverride => {
  try {
    const raw = localStorage.getItem(GEO_STORAGE_KEY);
    return raw ? { ...DEFAULT_GEO_OVERRIDE, ...JSON.parse(raw) } : { ...DEFAULT_GEO_OVERRIDE };
  } catch {
    return { ...DEFAULT_GEO_OVERRIDE };
  }
};

export const setGeoOverride = (next: GeoOverride): void => {
  localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(next));
};

export const getProfileBorderOpen = (): ProfileBorderOpen => {
  try {
    const raw = localStorage.getItem(PROFILE_BORDER_STORAGE_KEY);
    return raw
      ? { ...DEFAULT_PROFILE_BORDER_OPEN, ...JSON.parse(raw) }
      : { ...DEFAULT_PROFILE_BORDER_OPEN };
  } catch {
    return { ...DEFAULT_PROFILE_BORDER_OPEN };
  }
};

export const setProfileBorderOpen = (next: ProfileBorderOpen): void => {
  localStorage.setItem(PROFILE_BORDER_STORAGE_KEY, JSON.stringify(next));
};

export const getBlockedBots = (): string[] => {
  try {
    const raw = localStorage.getItem(BLOCKED_BOTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

export const getBlockedBotsFetchedAt = (): number => {
  const raw = localStorage.getItem(BLOCKED_BOTS_FETCHED_AT_STORAGE_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const setBlockedBots = (userIds: string[], fetchedAt: number): void => {
  localStorage.setItem(BLOCKED_BOTS_STORAGE_KEY, JSON.stringify(userIds));
  localStorage.setItem(BLOCKED_BOTS_FETCHED_AT_STORAGE_KEY, String(fetchedAt));
};

export const getBotBlockingEnabled = (): boolean => {
  const raw = localStorage.getItem(BOT_BLOCKING_ENABLED_STORAGE_KEY);
  return raw === null ? true : raw === "true";
};

export const setBotBlockingEnabled = (enabled: boolean): void => {
  localStorage.setItem(BOT_BLOCKING_ENABLED_STORAGE_KEY, String(enabled));
};

export const getBotBlockingSectionOpen = (): boolean => {
  return localStorage.getItem(BOT_BLOCKING_SECTION_OPEN_STORAGE_KEY) === "true";
};

export const setBotBlockingSectionOpen = (open: boolean): void => {
  localStorage.setItem(BOT_BLOCKING_SECTION_OPEN_STORAGE_KEY, String(open));
};

export const getBlockedBotEventsByDay = (): BlockedBotDailyLog => {
  try {
    const raw = localStorage.getItem(BLOCKED_BOT_EVENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BlockedBotDailyLog) : {};
  } catch {
    return {};
  }
};

export const recordBlockedBotEvent = (ids: string[]): void => {
  const next = recordBlockedBotIds(getBlockedBotEventsByDay(), ids);
  localStorage.setItem(BLOCKED_BOT_EVENTS_STORAGE_KEY, JSON.stringify(next));
};
