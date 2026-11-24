import { CM_PER_INCH, type FilterableProfile } from "../sniffies-api.js";
import {
  STAT_IDS,
  STAT_KEYS,
  type EndowmentPick,
  ENDOWMENT_TOP_INCHES,
  type ListStatId,
  type StatPicks,
  hasStatPick,
  parseStatPicks,
  loadNativePicks,
  saveNativePicks,
  nativePick,
} from "./stat-picks.js";
import { type ProfileFilterRule } from "./matcher.js";
import { type ProfileFilters } from "./filters.js";

const listRule = (
  id: ListStatId,
  getFilters: () => ProfileFilters,
  owns: () => boolean,
  read: (profile: FilterableProfile) => string | null | undefined,
): ProfileFilterRule => ({
  name: id,
  mapOnly: true,
  isActive: () => owns() && hasStatPick(id, getFilters().picks[id]),
  hides: (profile) => {
    if (!profile.data) {
      return false;
    }
    const value = read(profile);
    return value
      ? !(getFilters().picks[id] as string[]).includes(value)
      : !getFilters().unlisted[id];
  },
});

const endowmentRule = (
  getFilters: () => ProfileFilters,
  owns: () => boolean,
): ProfileFilterRule => ({
  name: "endowment",
  mapOnly: true,
  isActive: () => owns() && hasStatPick("endowment", getFilters().picks.endowment),
  hides: (profile) => {
    if (!profile.data) {
      return false;
    }
    const { min, max, cut } = getFilters().picks.endowment as EndowmentPick;
    const unlisted = getFilters().unlisted.endowment;
    const own = profile.data.profile?.extended?.stats?.endowment;
    if (typeof min === "number" || typeof max === "number") {
      const length = own?.lengthInCm;
      if (typeof length !== "number") {
        if (!unlisted) {
          return true;
        }
      } else if (
        (typeof min === "number" && length < Math.round(min * CM_PER_INCH)) ||
        (typeof max === "number" &&
          max < ENDOWMENT_TOP_INCHES &&
          length > Math.round(max * CM_PER_INCH))
      ) {
        return true;
      }
    }
    if (cut === "cut" || cut === "uncut") {
      if (typeof own?.isCut !== "boolean") {
        return !unlisted;
      }
      return own.isCut !== (cut === "cut");
    }
    return false;
  },
});

/** One of the filters Sniffies saves and restores on login (`authenticate/current`). */
interface SavedFilter {
  filterType?: string;
  value?: Record<string, unknown>;
  enabledValues?: Record<string, boolean>;
}

/**
 * Turns off our stats in a saved filter, returning the picks it had on for them.
 *
 * `Object.hasOwn` rather than `in`: the selection-limit hook defines an accessor for
 * `sexuality.attitude` on `Object.prototype`, which `in` sees and assigning to would add the key.
 */
const disableOurStats = (saved: SavedFilter): StatPicks => {
  const enabled = saved.enabledValues;
  const had: StatPicks = {};
  if (saved.filterType !== "CRUISER_STATS" || !enabled) {
    return had;
  }
  for (const id of STAT_IDS.filter((stat) => Object.hasOwn(enabled, STAT_KEYS[stat]))) {
    const key = STAT_KEYS[id];
    if (enabled[key] && saved.value?.[key] !== undefined) {
      Object.assign(had, parseStatPicks({ [id]: nativePick(id, saved.value[key]) }));
    }
    enabled[key] = false;
  }
  return had;
};

/**
 * Sniffies' own rows for these stats are replaced by ours, and Sniffies filters the map in the
 * browser too, hiding anyone with no value for a stat it has on. So `owns` (the profile filters
 * are on) takes them over completely: `rules` hide profiles our picks don't match, `rewriteBody`
 * keeps the stats out of map requests, and `disableSavedStats` loads them as off.
 */
export const statTakeover = (
  getFilters: () => ProfileFilters,
  owns: () => boolean = () => true,
) => {
  const rules = [
    listRule("position", getFilters, owns, (p) => p.data?.profile?.extended?.sexuality?.attitude),
    listRule("bodyType", getFilters, owns, (p) => p.data?.profile?.extended?.stats?.body),
    listRule("sexuality", getFilters, owns, (p) => p.data?.profile?.extended?.sexuality?.spectrum),
    endowmentRule(getFilters, owns),
  ];
  const rewriteBody = (body: string): string => {
    let json: { filters?: { CRUISER_STATS?: { value?: Record<string, unknown> } } };
    try {
      json = JSON.parse(body);
    } catch {
      return body;
    }
    const stats = json?.filters?.CRUISER_STATS;
    const sent = stats?.value && typeof stats.value === "object" ? stats.value : {};
    const ours = owns();
    const native = loadNativePicks();
    let stripped = false;
    for (const id of STAT_IDS) {
      const key = STAT_KEYS[id];
      if (ours) {
        if (sent[key] !== undefined) {
          delete sent[key];
          stripped = true;
        }
      } else if (sent[key] === undefined) {
        delete native[id];
      } else {
        Object.assign(native, parseStatPicks({ [id]: nativePick(id, sent[key]) }));
      }
    }
    if (!ours) {
      saveNativePicks(native);
    }
    if (!stripped || !stats) {
      return body;
    }
    if (Object.keys(sent).length === 0) {
      delete json.filters!.CRUISER_STATS;
    }
    return JSON.stringify(json);
  };
  /**
   * Sniffies restores its saved filters from the `authenticate/current` response. Remember the
   * picks it had for these stats (to start our rows from) and load the stats as off.
   */
  const disableSavedStats = (payload: unknown): unknown => {
    const users = (
      payload as {
        user?: { private?: { options?: { filters?: { USERS?: unknown } } } };
      } | null
    )?.user?.private?.options?.filters?.USERS;
    if (!owns() || !Array.isArray(users)) {
      return payload;
    }
    const native = loadNativePicks();
    for (const saved of users as SavedFilter[]) {
      Object.assign(native, disableOurStats(saved));
    }
    saveNativePicks(native);
    return payload;
  };
  return { rules, rewriteBody, disableSavedStats };
};
