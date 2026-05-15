import {
  DEFAULT_NOTIFY,
  PHONE_E164_REGEX,
  SETTINGS_KEYS,
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

const STORAGE_KEY_TEST_USED = SETTINGS_KEYS.notifyTestUsed;

const setTestButtonEnabled = (enabled: boolean): void => {
  if (testBtn instanceof HTMLButtonElement) {
    testBtn.disabled = !enabled;
  }
};

const setStatus = (text: string): void => {
  if (notifyStatus) {
    notifyStatus.textContent = text;
  }
};

const readNotifyForm = (): NotifySettings => ({
  phone: phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : "",
  endpoint: endpointInput instanceof HTMLInputElement ? endpointInput.value.trim() : "",
  secret: secretInput instanceof HTMLInputElement ? secretInput.value.trim() : "",
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

  const { [STORAGE_KEY_TEST_USED]: testUsed } =
    await chrome.storage.local.get(STORAGE_KEY_TEST_USED);
  setTestButtonEnabled(!testUsed);
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
  if (next.phone && !PHONE_E164_REGEX.test(next.phone)) {
    setStatus("Phone must be E.164 format, e.g. +15551234567");
    if (phoneInput instanceof HTMLInputElement) {
      phoneInput.classList.add("invalid");
      phoneInput.focus();
    }
    return;
  }
  if (phoneInput instanceof HTMLInputElement) {
    phoneInput.classList.remove("invalid");
  }
  await setNotify(next);
  setStatus("Saved.");
});

if (phoneInput instanceof HTMLInputElement) {
  phoneInput.addEventListener("input", async () => {
    phoneInput.classList.remove("invalid");
    await chrome.storage.local.set({ [STORAGE_KEY_TEST_USED]: false });
    setTestButtonEnabled(true);
  });
}

testBtn?.addEventListener("click", async () => {
  const next = readNotifyForm();
  await setNotify(next);
  await chrome.storage.local.set({ [STORAGE_KEY_TEST_USED]: true });
  setTestButtonEnabled(false);
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
