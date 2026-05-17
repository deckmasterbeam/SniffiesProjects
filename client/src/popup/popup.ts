import {
  DEFAULT_GEO_OVERRIDE,
  SETTINGS_KEYS,
  getLocalSettings,
  setGeoOverride,
  type GeoOverride,
} from "../shared/settings.js";

const randomAccuracy = (): number => Math.round((5 + Math.random() * 20) * 10) / 10;

const openSettingsBtn = document.getElementById("open-settings");
const geoDetails = document.querySelector<HTMLDetailsElement>("details.collapsible");

const geoEnabled = document.getElementById("geo-enabled") as HTMLInputElement;
const geoLat = document.getElementById("geo-lat") as HTMLInputElement;
const geoLng = document.getElementById("geo-lng") as HTMLInputElement;
const geoAccuracy = document.getElementById("geo-accuracy") as HTMLInputElement;
const geoFillCurrent = document.getElementById("geo-fill-current");
const geoSave = document.getElementById("geo-save");
const geoStatus = document.getElementById("geo-status");

const init = async (): Promise<void> => {
  const settings = await getLocalSettings();
  if (geoDetails) {
    geoDetails.open = settings.geoSectionOpen;
  }
  const geo = { ...DEFAULT_GEO_OVERRIDE, ...settings.geoOverride };
  geoEnabled.checked = geo.enabled;
  geoLat.value = String(geo.latitude);
  geoLng.value = String(geo.longitude);
  geoAccuracy.value = String(geo.accuracy);
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
  enabled: geoEnabled.checked,
  latitude: parseFloat(geoLat.value) || 0,
  longitude: parseFloat(geoLng.value) || 0,
  accuracy: parseFloat(geoAccuracy.value) || 10,
});

const reRandomizeAccuracy = (): void => {
  geoAccuracy.value = String(randomAccuracy());
};

geoEnabled.addEventListener("change", reRandomizeAccuracy);

for (const field of [geoLat, geoLng]) {
  field.addEventListener("blur", reRandomizeAccuracy);
}

geoFillCurrent?.addEventListener("click", () => {
  if (geoStatus) {
    geoStatus.textContent = "Getting location...";
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geoLat.value = String(pos.coords.latitude);
      geoLng.value = String(pos.coords.longitude);
      reRandomizeAccuracy();
      if (geoStatus) {
        geoStatus.textContent = "";
      }
    },
    (error) => {
      console.log("Failed to get current position", error);
      if (geoStatus) {
        geoStatus.textContent = "Could not get location.";
      }
    },
  );
});

geoSave?.addEventListener("click", async () => {
  await setGeoOverride(readGeoForm());
  if (geoStatus) {
    geoStatus.textContent = "Saved. Reload sniffies.com to apply.";
  }
});

void init();
