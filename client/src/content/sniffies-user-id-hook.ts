// Runs in the page's MAIN world at document_start on www.sniffies.com.
// Wraps WebSocket to observe the logged-in user's own id off the
// prod.ws.sniffies.com connection URL.

import { installUserIdHook } from "@sniffies-projects/core";
import { createLogger } from "../shared/log.js";

(() => {
  const log = createLogger("user-id");

  const installed = installUserIdHook((userId) => {
    log("user id observed", userId);
    window.postMessage({ source: "sniffies-user-id-hook", userId }, "*");
  });

  if (installed) {
    log("user id hook installed");
  }
})();
