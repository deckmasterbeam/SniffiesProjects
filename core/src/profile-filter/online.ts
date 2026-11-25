import { STRINGS } from "../strings.js";
import { type ProfileFilterRule } from "./matcher.js";

export interface OnlineFilter {
  enabled: boolean;
  minutes: number | null;
  pickedAt?: number;
  cutoff?: number;
}

export const DEFAULT_ONLINE_FILTER: OnlineFilter = { enabled: false, minutes: null };

export const ONLINE_MINUTES = [15, 30, 45, 60, 90, 180, 360, 720, 1440, 2160, 2880];

export const onlineLabel = (minutes: number): string => STRINGS.filterMenu.onlineAgo(minutes);

export const parseOnlineFilter = (value: unknown): OnlineFilter => {
  const raw = (value ?? {}) as { enabled?: unknown; minutes?: unknown; cutoff?: unknown };
  const minutes = ONLINE_MINUTES.includes(raw.minutes as number) ? (raw.minutes as number) : null;
  const filter: OnlineFilter = { enabled: raw.enabled === true && minutes !== null, minutes };
  if (minutes !== null && typeof raw.cutoff === "number" && isFinite(raw.cutoff)) {
    filter.cutoff = raw.cutoff;
  }
  return filter;
};

export const onlineKey = (filter: OnlineFilter): string => {
  if (!filter.enabled || filter.minutes === null) {
    return "";
  }
  return filter.cutoff === undefined ? String(filter.minutes) : `static${filter.cutoff}`;
};

export const clockText = (time: number, now: number): string => {
  const at = new Date(time);
  const clock = at
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(/\s+/g, "");
  const day =
    at.toDateString() === new Date(now).toDateString()
      ? ""
      : `${at.toLocaleDateString([], { weekday: "short" })} `;
  return `${day}${clock}`;
};

export const onlineSinceLabel = (minutes: number, from: number): string =>
  STRINGS.filterMenu.cruisersOnlineAfter(clockText(from - minutes * 60_000, from));

export const onlineRule = (getFilter: () => OnlineFilter): ProfileFilterRule => {
  const loadedAt = Date.now();
  return {
    name: "online",
    mapOnly: true,
    keepsOnMap: true,
    isActive: () => onlineKey(getFilter()) !== "",
    hides: (profile) => {
      if (!profile.data) {
        return false;
      }
      // A missing connect time is NaN, it wasn't online recently.
      return !(
        Date.parse(profile.data.connectUpdateTime ?? "") >=
        (getFilter().cutoff ?? loadedAt - getFilter().minutes! * 60_000)
      );
    },
  };
};
