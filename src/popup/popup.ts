import {
  DEFAULT_NOTIFY,
  getLocalSettings,
  setDebug,
  setNotify,
  type NotifySettings,
} from "../shared/settings.js";

const debugToggle = document.getElementById("debug-toggle");
const openFavoritesBtn = document.getElementById("open-favorites");
const phoneInput = document.getElementById("notify-phone");
const endpointInput = document.getElementById("notify-endpoint");
const secretInput = document.getElementById("notify-secret");
const saveBtn = document.getElementById("notify-save");
const testBtn = document.getElementById("notify-test");
const notifyStatus = document.getElementById("notify-status");
const notifyDebugFields = document.getElementById("notify-debug-fields");

const setDebugFieldsVisible = (visible: boolean): void => {
  if (notifyDebugFields instanceof HTMLElement) {
    notifyDebugFields.style.display = visible ? "flex" : "none";
  }
};

const setStatus = (text: string): void => {
  if (notifyStatus) {
    notifyStatus.textContent = text;
  }
};

const readNotifyForm = (): NotifySettings => ({
  phone: phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : "",
  endpoint:
    endpointInput instanceof HTMLInputElement ? endpointInput.value.trim() : "",
  secret:
    secretInput instanceof HTMLInputElement ? secretInput.value.trim() : "",
});

const init = async (): Promise<void> => {
  const { debug, notify } = await getLocalSettings();
  if (debugToggle instanceof HTMLInputElement) {
    debugToggle.checked = debug;
  }
  setDebugFieldsVisible(debug);
  const merged = { ...DEFAULT_NOTIFY, ...notify };
  if (phoneInput instanceof HTMLInputElement) {
    phoneInput.value = merged.phone;
  }
  if (endpointInput instanceof HTMLInputElement) {
    endpointInput.value = merged.endpoint;
  }
  if (secretInput instanceof HTMLInputElement) {
    secretInput.value = merged.secret;
  }
};

if (debugToggle instanceof HTMLInputElement) {
  debugToggle.addEventListener("change", () => {
    void setDebug(debugToggle.checked);
    setDebugFieldsVisible(debugToggle.checked);
  });
}

openFavoritesBtn?.addEventListener("click", () => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("src/favorites/favorites.html"),
  });
  window.close();
});

saveBtn?.addEventListener("click", async () => {
  const next = readNotifyForm();
  await setNotify(next);
  setStatus("Saved.");
});

testBtn?.addEventListener("click", async () => {
  const next = readNotifyForm();
  await setNotify(next);
  setStatus("Sending test...");
  try {
    const response = await chrome.runtime.sendMessage({
      type: "NOTIFY_TEST",
    });
    if (response?.ok) {
      setStatus(`Test sent (sid ${response.sid ?? "?"}).`);
    } else {
      setStatus(`Failed: ${response?.error ?? "unknown"}`);
    }
  } catch (err) {
    setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
  }
});

void init();
