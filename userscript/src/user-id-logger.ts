// Installs the shared user-id hook and reports client init telemetry to the
// server once per userscript lifetime. Unlike the Chrome extension, the
// userscript runs entirely in the page's own world, so the observed userId
// can be reported directly — no postMessage relay is needed.

import { installUserIdHook, logInit, createLogger } from "@sniffies-projects/core";
import { CLIENT_SECRET, SERVER_BASE, VERSION } from "./shared/env.js";

const log = createLogger("user-id-logger");

export const installUserIdLogging = (onUserId?: (userId: string) => void): boolean => {
  let initLogged = false;
  return installUserIdHook((userId) => {
    log("user id observed", userId);
    onUserId?.(userId);
    if (initLogged) {
      return;
    }
    initLogged = true;
    void logInit({
      serverBase: SERVER_BASE,
      clientSecret: CLIENT_SECRET,
      userId,
      clientType: "userscript",
      version: VERSION,
    });
  });
};
