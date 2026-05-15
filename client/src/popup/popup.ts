import {
  DEFAULT_NOTIFY,
  DEFAULT_GEO_OVERRIDE,
  PHONE_E164_REGEX,
  SETTINGS_KEYS,
  getLocalSettings,
  setDebug,
  setNotify,
  setGeoOverride,
  type NotifySettings,
  type GeoOverride,
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

const geoEnabled = document.getElementById("geo-enabled");
const geoLat = document.getElementById("geo-lat");
const geoLng = document.getElementById("geo-lng");
const geoAccuracy = document.getElementById("geo-accuracy");
const geoFillCurrent = document.getElementById("geo-fill-current");
const geoSave = document.getElementById("geo-save");
const geoStatus = document.getElementById("geo-status");

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
  const settings = await getLocalSettings();
  const { debug, notify } = settings;
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

  const geo = { ...DEFAULT_GEO_OVERRIDE, ...settings.geoOverride };
  if (geoEnabled instanceof HTMLInputElement) geoEnabled.checked = geo.enabled;
  if (geoLat instanceof HTMLInputElement) geoLat.value = String(geo.latitude);
  if (geoLng instanceof HTMLInputElement) geoLng.value = String(geo.longitude);
  if (geoAccuracy instanceof HTMLInputElement) geoAccuracy.value = String(geo.accuracy);
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

const readGeoForm = (): GeoOverride => ({
  enabled: geoEnabled instanceof HTMLInputElement ? geoEnabled.checked : false,
  latitude: geoLat instanceof HTMLInputElement ? parseFloat(geoLat.value) || 0 : 0,
  longitude: geoLng instanceof HTMLInputElement ? parseFloat(geoLng.value) || 0 : 0,
  accuracy: geoAccuracy instanceof HTMLInputElement ? parseFloat(geoAccuracy.value) || 10 : 10,
});

geoFillCurrent?.addEventListener("click", () => {
  if (geoStatus) geoStatus.textContent = "Getting location...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (geoLat instanceof HTMLInputElement) geoLat.value = String(pos.coords.latitude);
      if (geoLng instanceof HTMLInputElement) geoLng.value = String(pos.coords.longitude);
      if (geoStatus) geoStatus.textContent = "";
    },
    (error) => {
      console.log("Failed to get current position", error);
      if (geoStatus) geoStatus.textContent = "Could not get location.";
    },
  );
});

geoSave?.addEventListener("click", async () => {
  await setGeoOverride(readGeoForm());
  if (geoStatus) geoStatus.textContent = "Saved. Reload sniffies.com to apply.";
});

void init();