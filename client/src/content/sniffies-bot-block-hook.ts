import {
  botBlockRule,
  createLogger,
  installProfileFilterHook,
  installSelectionLimitOverride,
  loadFiltersMirror,
  parseProfileFilters,
  profileFilterRules,
  statTakeover,
  type BotBlockState,
} from "@sniffies-projects/core";

(() => {
  const log = createLogger("bot-block");

  let state: BotBlockState = { blockedIds: new Set(), enabled: false };
  const mirror = loadFiltersMirror();
  let profileFilters = mirror.filters;
  let profileFiltersEnabled = mirror.enabled;
  let boundaryEnabled = false;

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const msg = event.data as Record<string, unknown> | null;
    if (!msg || msg.source !== "sniffies-bot-block-relay") {
      return;
    }
    const blockedIds = Array.isArray(msg.blockedIds) ? (msg.blockedIds as string[]) : [];
    state = { blockedIds: new Set(blockedIds), enabled: msg.enabled === true };
    profileFilters = parseProfileFilters(msg.profileFilters);
    profileFiltersEnabled = msg.profileFiltersEnabled === true;
    boundaryEnabled = msg.boundaryEnabled === true;
    log("state updated", {
      count: state.blockedIds.size,
      enabled: state.enabled,
      profileFilters,
      ms: Math.round(performance.now()),
    });
  });

  const takeover = statTakeover(
    () => profileFilters,
    () => profileFiltersEnabled,
  );
  const result = installProfileFilterHook(
    [
      botBlockRule(
        () => state,
        (ids) => {
          window.postMessage({ source: "sniffies-bot-block-hook", kind: "filtered", ids }, "*");
        },
      ),
      ...profileFilterRules(() => profileFilters),
      ...takeover.rules,
    ],
    () => boundaryEnabled,
    takeover.rewriteBody,
    takeover.disableSavedStats,
  );
  log("profile-filter hook installed", result);

  installSelectionLimitOverride(() => profileFiltersEnabled);
})();
