import {
  DEFAULT_GEO_OVERRIDE,
  SETTINGS_KEYS,
  getLocalSettings,
  setGeoOverride,
  type GeoOverride,
} from "../shared/settings.js";

const openSettingsBtn = document.getElementById("open-settings");
const geoDetails = document.querySelector<HTMLDetailsElement>("details.collapsible");

const geoEnabled = document.getElementById("geo-enabled");
const geoLat = document.getElementById("geo-lat");
const geoLng = document.getElementById("geo-lng");
const geoAccuracy = document.getElementById("geo-accuracy");
const geoFillCurrent = document.getElementById("geo-fill-current");
const geoSave = document.getElementById("geo-save");
const geoStatus = document.getElementById("geo-status");

const init = async (): Promise<void> => {
  const settings = await getLocalSettings();
  if (geoDetails) geoDetails.open = settings.geoSectionOpen;
  const geo = { ...DEFAULT_GEO_OVERRIDE, ...settings.geoOverride };
  if (geoEnabled instanceof HTMLInputElement) geoEnabled.checked = geo.enabled;
  if (geoLat instanceof HTMLInputElement) geoLat.value = String(geo.latitude);
  if (geoLng instanceof HTMLInputElement) geoLng.value = String(geo.longitude);
  if (geoAccuracy instanceof HTMLInputElement) geoAccuracy.value = String(geo.accuracy);
};

geoDetails?.addEventListener("toggle", () => {
  void chrome.storage.local.set({ [SETTINGS_KEYS.geoSectionOpen]: geoDetails.open });
});

openSettingsBtn?.addEventListener("click", () => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("src/settings/settings.html"),
  });
  window.close();
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
