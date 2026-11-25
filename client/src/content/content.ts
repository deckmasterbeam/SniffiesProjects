import { createLogger } from "@sniffies-projects/core";

const log = createLogger("content");
log("loaded on", location.href);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ reply: `pong from ${location.hostname}` });
    return true;
  }
  return false;
});
