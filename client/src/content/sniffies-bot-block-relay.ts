// Isolated world. Reads the blocked-bots list + toggle from extension storage
// and forwards them to the MAIN-world bot-block hook via window.postMessage,
// both on load and whenever either setting changes. Also listens for the
// hook reporting back which accounts it actually filtered, and records them
// into the day-bucketed log the popup reads for its "N bots blocked in the
// last 24 hours" count.

import { createLogger } from "@sniffies-projects/core";
import { SETTINGS_KEYS, getLocalSettings, recordBlockedBotEvent } from "../shared/settings.js";

const log = createLogger("bot-block-relay");

const postState = (blockedIds: string[], enabled: boolean): void => {
  window.postMessage(
    {
      source: "sniffies-bot-block-relay",
      blockedIds,
      enabled,
    },
    "*",
  );
};

void getLocalSettings().then(({ blockedBots, botBlockingEnabled }) => {
  log("relaying initial state", { count: blockedBots.length, enabled: botBlockingEnabled });
  postState(blockedBots, botBlockingEnabled);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  if (!changes[SETTINGS_KEYS.blockedBots] && !changes[SETTINGS_KEYS.botBlockingEnabled]) {
    return;
  }
  void getLocalSettings().then(({ blockedBots, botBlockingEnabled }) => {
    log("relaying updated state", { count: blockedBots.length, enabled: botBlockingEnabled });
    postState(blockedBots, botBlockingEnabled);
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
