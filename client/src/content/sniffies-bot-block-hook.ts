import {
  botBlockRule,
  createLogger,
  installProfileFilterHook,
  installSelectionLimitOverride,
  parseProfileFilters,
  profileFilterRules,
  type BotBlockState,
} from "@sniffies-projects/core";

(() => {
  const log = createLogger("bot-block");

  let state: BotBlockState = { blockedIds: new Set(), enabled: false };
  let profileFilters = parseProfileFilters(null);
  let profileFiltersEnabled = false;

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
    log("state updated", {
      count: state.blockedIds.size,
      enabled: state.enabled,
      profileFilters,
      ms: Math.round(performance.now()),
    });
  });

  const result = installProfileFilterHook([
    botBlockRule(
      () => state,
      (ids) => {
        window.postMessage({ source: "sniffies-bot-block-hook", kind: "filtered", ids }, "*");
      },
    ),
    ...profileFilterRules(() => profileFilters),
  ]);
  log("profile-filter hook installed", result);

  installSelectionLimitOverride(() => profileFiltersEnabled);
})();
