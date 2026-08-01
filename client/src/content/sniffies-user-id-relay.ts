// Isolated world. Receives the observed Sniffies user id from the MAIN world
// hook via window.postMessage, persists it to extension storage, and reports
// client init telemetry to the server (once per content-script lifetime).

import { logInit, createLogger } from "@sniffies-projects/core";
import { CLIENT_SECRET, SERVER_BASE } from "../shared/env.js";
import { setSniffiesUserId } from "../shared/settings.js";

const log = createLogger("user-id-relay");

let initLogged = false;

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const msg = event.data as Record<string, unknown> | null;
  if (!msg || msg.source !== "sniffies-user-id-hook" || typeof msg.userId !== "string") {
    return;
  }
  log("persisting user id", msg.userId);
  void setSniffiesUserId(msg.userId);

  if (!initLogged) {
    initLogged = true;
    void logInit({
      serverBase: SERVER_BASE,
      clientSecret: CLIENT_SECRET,
      userId: msg.userId,
      clientType: "chrome-client",
      version: chrome.runtime.getManifest().version,
    });
  }
});
