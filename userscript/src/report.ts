import {
  installBotBlockHook,
  installReportButtonInjection,
  refreshBlockedBotsIfStale as refreshBlockedBotsIfStaleShared,
  type BotBlockState,
} from "@sniffies-projects/core";
import { CLIENT_SECRET, REPORTING_ENABLED, SERVER_BASE } from "./shared/env.js";
import {
  getBlockedBots,
  getBlockedBotsFetchedAt,
  getBotBlockingEnabled,
  recordBlockedBotEvent,
  setBlockedBots,
} from "./shared/local-storage.js";

export interface ReportFeatureState {
  currentSniffiesUserId: string;
  botBlockState: BotBlockState;
}

const clientHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${CLIENT_SECRET}`,
});

/** Installs the bot-block network hook */
export const installReportFeature = (): ReportFeatureState => {
  const state: ReportFeatureState = {
    currentSniffiesUserId: "",
    botBlockState: { blockedIds: new Set(getBlockedBots()), enabled: getBotBlockingEnabled() },
  };

  installBotBlockHook(
    () => state.botBlockState,
    (ids) => recordBlockedBotEvent(ids),
  );

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
