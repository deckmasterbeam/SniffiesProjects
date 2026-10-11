import {
  botBlockRule,
  gateProfileFilters,
  installProfileFilterHook,
  installReportButtonInjection,
  refreshBlockedBotsIfStale as refreshBlockedBotsIfStaleShared,
  type BotBlockState,
  profileFilterRules,
  type ProfileFilters,
} from "@sniffies-projects/core";
import { CLIENT_SECRET, REPORTING_ENABLED, SERVER_BASE } from "./shared/env.js";
import {
  getBlockedBots,
  getBlockedBotsFetchedAt,
  getBotBlockingEnabled,
  getProfileFilters,
  getProfileFiltersEnabled,
  recordBlockedBotEvent,
  setBlockedBots,
} from "./shared/local-storage.js";

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
export const installReportFeature = (): ReportFeatureState => {
  const state: ReportFeatureState = {
    currentSniffiesUserId: "",
    botBlockState: { blockedIds: new Set(getBlockedBots()), enabled: getBotBlockingEnabled() },

    appliedProfileFilters: gateProfileFilters(getProfileFilters(), getProfileFiltersEnabled()),
  };

  installProfileFilterHook([
    botBlockRule(
      () => state.botBlockState,
      (ids) => recordBlockedBotEvent(ids),
    ),
    ...profileFilterRules(() => state.appliedProfileFilters),
  ]);

  if (REPORTING_ENABLED) {
    installReportButtonInjection({
      serverBase: SERVER_BASE,
      getAuthHeaders: clientHeaders,
      reportingEnabled: true,
      getReporterUserId: () => state.currentSniffiesUserId,
    });
  }

  return state;
};

export const refreshBlockedBotsIfStale = (state: ReportFeatureState): void => {
  if (!REPORTING_ENABLED) {
    return;
  }
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
