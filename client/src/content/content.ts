// Content script - runs in the context of web pages (isolated world).

import { createLogger } from "../shared/log.js";

const log = createLogger("content");
log("loaded on", location.href);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ reply: `pong from ${location.hostname}` });
    return true;
  }
  return false;
});
