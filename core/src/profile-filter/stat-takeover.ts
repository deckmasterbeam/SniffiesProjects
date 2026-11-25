import { createLogger } from "@core/log.js";
import { type ProfileFilters } from "@core/profile-filter/filters.js";
import { type ProfileFilterRule } from "@core/profile-filter/matcher.js";
import {
  type EndowmentPick,
  type ListStatId,
  RANGE_STAT_TOP,
  type RangePick,
  type RangeStatId,
  STAT_IDS,
  STAT_KEYS,
  type StatPicks,
  hasStatPick,
  loadNativePicks,
  parseStatPicks,
  saveNativePicks,
} from "@core/profile-filter/stat-picks.js";
import { saveUnits, unitsFromAccount } from "@core/profile-filter/units.js";
import { type FilterableProfile } from "@core/sniffies-api.js";

const log = createLogger("profile-filter");
let reportedNoFilters = false;

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

/** Whether a listed value is outside the pick; the top stop of a range means "and up". */
const outsideRange = (value: number, { min, max }: RangePick, id: RangeStatId): boolean =>
  (typeof min === "number" && value < min) ||
  (typeof max === "number" && max < RANGE_STAT_TOP[id] && value > max);

const ageRule = (getFilters: () => ProfileFilters, owns: () => boolean): ProfileFilterRule => ({
  name: "age",
  mapOnly: true,
  isActive: () => owns() && hasStatPick("age", getFilters().picks.age),
  hides: (profile) => {
    if (!profile.data) {
      return false;
    }
    const age = profile.data.profile?.extended?.stats?.age;
    return typeof age === "number"
      ? outsideRange(age, getFilters().picks.age as RangePick, "age")
      : !getFilters().unlisted.age;
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
      } else if (outsideRange(length, { min, max }, "endowment")) {
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

interface SavedFilter {
  filterType?: string;
  value?: Record<string, unknown>;
  enabledValues?: Record<string, boolean>;
}

const disableOurStats = (saved: SavedFilter): StatPicks => {
  const enabled = saved.enabledValues;
  const had: StatPicks = {};
  if (saved.filterType !== "CRUISER_STATS" || !enabled) {
    return had;
  }
  for (const id of STAT_IDS.filter((stat) => Object.hasOwn(enabled, STAT_KEYS[stat]))) {
    const key = STAT_KEYS[id];
    if (enabled[key] && saved.value?.[key] !== undefined) {
      Object.assign(had, parseStatPicks({ [id]: saved.value[key] }));
    }
    enabled[key] = false;
  }
  return had;
};

export const statTakeover = (
  getFilters: () => ProfileFilters,
  owns: () => boolean = () => true,
) => {
  const rules = [
    ageRule(getFilters, owns),
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

    if (
      owns() &&
      (typeof json?.filters !== "object" || json.filters === null) &&
      !reportedNoFilters
    ) {
      reportedNoFilters = true;
      log.warn("map request has no filters object; Sniffies may have changed its request shape");
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
        Object.assign(native, parseStatPicks({ [id]: sent[key] }));
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

  const disableSavedStats = (payload: unknown): unknown => {
    const units = unitsFromAccount(payload);
    if (units) {
      saveUnits(units);
    }
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
