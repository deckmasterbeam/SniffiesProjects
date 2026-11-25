import {
  botBlockRule,
  gateProfileFilters,
  installProfileFilterHook,
  installReportButtonInjection,
  profileFilterRules,
  refreshBlockedBotsIfStale as refreshBlockedBotsIfStaleShared,
  statTakeover,
  type BotBlockState,
  type ProfileFilters,
} from "@sniffies-projects/core";
import { CLIENT_SECRET, SERVER_BASE } from "@userscript/shared/env.js";
import {
  getBlockedBots,
  getBlockedBotsFetchedAt,
  getBotBlockingEnabled,
  getProfileFilters,
  getProfileFiltersEnabled,
  recordBlockedBotEvent,
  setBlockedBots,
} from "@userscript/shared/local-storage.js";

export interface ReportFeatureState {
  currentSniffiesUserId: string;
  botBlockState: BotBlockState;
  /** The filters the network hook runs with for this page load. */
  appliedProfileFilters: ProfileFilters;
}

const clientHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${CLIENT_SECRET}`,
});

/** Installs the profile-filter network hook (blocked bots + the filter menu's filters) */
export const installReportFeature = (raiseRadius?: () => boolean): ReportFeatureState => {
  const filtersEnabled = getProfileFiltersEnabled();
  const state: ReportFeatureState = {
    currentSniffiesUserId: "",
    botBlockState: { blockedIds: new Set(getBlockedBots()), enabled: getBotBlockingEnabled() },

    appliedProfileFilters: gateProfileFilters(getProfileFilters(), filtersEnabled),
  };

  const takeover = statTakeover(
    () => state.appliedProfileFilters,
    () => filtersEnabled,
  );
  installProfileFilterHook(
    [
      botBlockRule(
        () => state.botBlockState,
        (ids) => recordBlockedBotEvent(ids),
      ),
      ...profileFilterRules(() => state.appliedProfileFilters),
      ...takeover.rules,
    ],
    raiseRadius,
    takeover.rewriteBody,
    takeover.disableSavedStats,
  );

  installReportButtonInjection({
    serverBase: SERVER_BASE,
    getAuthHeaders: clientHeaders,
    getReporterUserId: () => state.currentSniffiesUserId,
  });

  return state;
};

export const refreshBlockedBotsIfStale = (state: ReportFeatureState): void => {
  refreshBlockedBotsIfStaleShared(
    getBlockedBotsFetchedAt(),
    SERVER_BASE,
    clientHeaders,
    (userIds, fetchedAt) => {
      setBlockedBots(userIds, fetchedAt);
      state.botBlockState = { ...state.botBlockState, blockedIds: new Set(userIds) };
    },
  );
};
