import {
  createLogger,
  gateProfileFilters,
  installProfileFiltersMenu,
  parseProfileFilters,
  type ExtensionLocalSettings,
  type ProfileFilters,
} from "@sniffies-projects/core";
import {
  SETTINGS_KEYS,
  getLocalSettings,
  recordBlockedBotEvent,
  setProfileFilters,
} from "../shared/settings.js";

const log = createLogger("bot-block-relay");

const postState = (
  blockedIds: string[],
  enabled: boolean,
  profileFilters: ProfileFilters,
  profileFiltersEnabled: boolean,
): void => {
  window.postMessage(
    {
      source: "sniffies-bot-block-relay",
      blockedIds,
      enabled,
      profileFilters,
      profileFiltersEnabled,
    },
    "*",
  );
};

// The filters the hook was given when the page loaded.
let appliedFilters: ProfileFilters | null = null;
let removeFiltersMenu: (() => void) | null = null;

const relay = (settings: ExtensionLocalSettings): void => {
  const { blockedBots, botBlockingEnabled, profileFiltersEnabled } = settings;
  const stored = parseProfileFilters(settings.profileFilters);

  const effective = gateProfileFilters(stored, profileFiltersEnabled);
  appliedFilters ??= effective;
  postState(blockedBots, botBlockingEnabled, effective, profileFiltersEnabled);

  if (profileFiltersEnabled && !removeFiltersMenu) {
    removeFiltersMenu = installProfileFiltersMenu({
      initial: stored,
      applied: appliedFilters,
      onChange: setProfileFilters,
    });
  } else if (!profileFiltersEnabled && removeFiltersMenu) {
    removeFiltersMenu();
    removeFiltersMenu = null;
  }
};

void getLocalSettings().then((settings) => {
  log("relaying initial state", {
    count: settings.blockedBots.length,
    enabled: settings.botBlockingEnabled,
  });
  relay(settings);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  if (
    !changes[SETTINGS_KEYS.blockedBots] &&
    !changes[SETTINGS_KEYS.botBlockingEnabled] &&
    !changes[SETTINGS_KEYS.profileFilters] &&
    !changes[SETTINGS_KEYS.profileFiltersEnabled]
  ) {
    return;
  }
  void getLocalSettings().then((settings) => {
    log("relaying updated state", {
      count: settings.blockedBots.length,
      enabled: settings.botBlockingEnabled,
    });
    relay(settings);
  });
});

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const msg = event.data as Record<string, unknown> | null;
  if (!msg || msg.source !== "sniffies-bot-block-hook" || msg.kind !== "filtered") {
    return;
  }
  const ids = Array.isArray(msg.ids) ? (msg.ids as string[]) : [];
  if (ids.length > 0) {
    void recordBlockedBotEvent(ids);
  }
});
