import type { BotBlockState } from "@core/contracts.js";
import { createLogger } from "@core/log.js";
import { type FilterableProfile } from "@core/sniffies-api.js";

export interface ProfileFilterRule {
  name: string;
  isActive: () => boolean;
  hides: (profile: FilterableProfile) => boolean;
  mapOnly?: boolean;
  keepsOnMap?: boolean;
  onFiltered?: (ids: string[]) => void;
}

export interface ProfileChecks {
  hidesProfile: (profile: FilterableProfile) => boolean;
  hidesId: (id: string) => boolean;
}

export interface ProfileMatcher extends ProfileChecks {
  isActive: () => boolean;
  keepsOnMap: () => boolean;
  chat: ProfileChecks;
  setSelfId: (id: string) => void;
  noteUpdate: (partial: FilterableProfile) => void;
  flush: () => { rule: string; ids: string[] }[];
}

const EXPECTED_PROFILE_PATHS = [
  "data.connectUpdateTime",
  "data.profile.extended.sexuality",
  "data.profile.extended.stats.heightInCm",
  "data.profile.extended.stats.weightInKg",
];

const hasPath = (root: unknown, path: string): boolean => {
  let node = root;
  for (const key of path.split(".")) {
    if (typeof node !== "object" || node === null || !(key in node)) {
      return false;
    }
    node = (node as Record<string, unknown>)[key];
  }
  return true;
};

const log = createLogger("profile-filter");
const reportedGaps = new Set<string>();

const warnIfIncomplete = (profile: FilterableProfile): void => {
  for (const path of EXPECTED_PROFILE_PATHS) {
    if (!reportedGaps.has(path) && !hasPath(profile, path)) {
      reportedGaps.add(path);
      log.warn(
        `profile ${profile._id} has no ${path}; Sniffies may have changed its profile format`,
      );
    }
  }
};

export const createProfileMatcher = (rules: readonly ProfileFilterRule[]): ProfileMatcher => {
  const seen = new Map<string, FilterableProfile>();
  const hidden = new Map<ProfileFilterRule, Set<string>>();
  let selfId = "";

  const hides = (profile: FilterableProfile, inChat: boolean): boolean => {
    if (profile._id === selfId) {
      return false;
    }
    const rule = rules.find((r) => r.isActive() && !(inChat && r.mapOnly) && r.hides(profile));
    if (!rule) {
      return false;
    }
    if (!hidden.has(rule)) {
      hidden.set(rule, new Set());
    }
    hidden.get(rule)!.add(profile._id);
    return true;
  };

  const checks = (inChat: boolean): ProfileChecks => ({
    hidesProfile: (profile) => {
      if (profile.data) {
        warnIfIncomplete(profile);
        seen.set(profile._id, profile);
      }
      return hides(profile, inChat);
    },
    hidesId: (id) => hides(seen.get(id) ?? { _id: id }, inChat),
  });

  return {
    isActive: () => rules.some((r) => r.isActive()),
    keepsOnMap: () => rules.some((r) => r.keepsOnMap && r.isActive()),
    ...checks(false),
    chat: checks(true),
    setSelfId: (id) => {
      selfId = id;
    },
    noteUpdate: ({ _id, data }) => {
      const known = seen.get(_id);
      if (known?.data && data?.connectUpdateTime) {
        seen.set(_id, {
          ...known,
          data: { ...known.data, connectUpdateTime: data.connectUpdateTime },
        });
      }
    },
    flush: () => {
      const result = [...hidden].map(([rule, ids]) => ({ rule, ids: [...ids] }));
      hidden.clear();
      for (const { rule, ids } of result) {
        rule.onFiltered?.(ids);
      }
      return result.map(({ rule, ids }) => ({ rule: rule.name, ids }));
    },
  };
};

export const botBlockRule = (
  getState: () => BotBlockState,
  onFiltered?: (ids: string[]) => void,
): ProfileFilterRule => ({
  name: "bot-block",
  isActive: () => getState().enabled && getState().blockedIds.size > 0,
  hides: (profile) => getState().blockedIds.has(profile._id),
  onFiltered,
});
