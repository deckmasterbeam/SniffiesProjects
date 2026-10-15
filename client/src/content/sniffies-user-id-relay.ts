import { logInit, createLogger } from "@sniffies-projects/core";
import { CLIENT_SECRET, SERVER_BASE } from "../shared/env.js";
import { setHasPlus, setSniffiesUserId } from "../shared/settings.js";

const log = createLogger("user-id-relay");

let initLogged = false;

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const msg = event.data as Record<string, unknown> | null;
  if (msg?.source === "sniffies-plus-hook" && typeof msg.hasPlus === "boolean") {
    void setHasPlus(msg.hasPlus);
    return;
  }
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
