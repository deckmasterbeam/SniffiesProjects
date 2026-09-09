// Wires the report-button injection (core/src/report-button-hook.ts, shared
// verbatim with the Chrome client's src/content/sniffies-profile-id.ts — see
// that module's header for the panel-switch/deep-link/no-photo race handling
// it covers) and the bot-blocking network filter. The userscript runs
// entirely in the page's own world (no isolated-world relay needed, see
// user-id-logger.ts), so both install directly here rather than needing a
// postMessage bridge. Favorites/star injection is excluded — the userscript
// has no favorites feature.

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
} from "./shared/settings.js";

export interface ReportFeatureState {
  currentSniffiesUserId: string;
  botBlockState: BotBlockState;
}

const clientHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${CLIENT_SECRET}`,
});

/**
 * Installs the bot-block network hook (always, mirroring the Chrome client's
 * MAIN-world hook script) and, if REPORTING_ENABLED, the report-button
 * injection machinery. Returns the mutable state object — the caller wires
 * currentSniffiesUserId from installUserIdLogging's callback, and the
 * bot-block panel UI reads/writes botBlockState directly.
 */
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
