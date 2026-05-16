// Background service worker (Manifest V3).
// Runs on demand; do not rely on long-lived global state.

interface ExtensionSyncSettings {
  enabled: boolean;
  installedAt: number;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[bg] onInstalled", details.reason);
  const defaults: ExtensionSyncSettings = {
    enabled: true,
    installedAt: Date.now(),
  };
  const existing = await chrome.storage.sync.get(Object.keys(defaults));
  const merged = { ...defaults, ...existing };
  await chrome.storage.sync.set(merged);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    chrome.storage.sync.get(null).then((settings) => {
      sendResponse({ ok: true, settings });
    });
    return true;
  }

  return false;
});
