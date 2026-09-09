// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Patches XHR + WebSocket to filter blocked-bot accounts out of the map init
// payload, chat init payload, an opened chat thread, and live WebSocket
// presence events before the Sniffies app ever parses them.
//
// This depends on reverse-engineered Sniffies wire formats (see TODO.md
// section 5 for the HAR-derived field paths) that can change without notice
// and silently stop filtering — including the API hostname itself, which is
// not fixed (confirmed via two HAR captures minutes apart). Check the
// console for "[sniffies-bot-block]" warnings naming filtered accounts if
// you suspect filtering has stopped working.

import { installBotBlockHook, type BotBlockState, createLogger } from "@sniffies-projects/core";

(() => {
  const log = createLogger("bot-block");

  // The isolated-world relay hasn't necessarily delivered the real blocklist
  // yet by the time this runs (it needs to read chrome.storage first) — start
  // disabled so early responses pass through unfiltered rather than racing it.
  let state: BotBlockState = { blockedIds: new Set(), enabled: false };

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
    log("state updated", { count: state.blockedIds.size, enabled: state.enabled });
  });

  const result = installBotBlockHook(
    () => state,
    (ids) => {
      window.postMessage({ source: "sniffies-bot-block-hook", kind: "filtered", ids }, "*");
    },
  );
  log("bot-block hook installed", result);
})();
