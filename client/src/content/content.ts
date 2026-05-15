// Content script - runs in the context of web pages (isolated world).

console.log("[sniffies-content] loaded on", location.href);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ reply: `pong from ${location.hostname}` });
    return true;
  }
  return false;
});
