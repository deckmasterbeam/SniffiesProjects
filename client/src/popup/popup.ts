import { FAVORITES_NOTIFICATIONS_ENABLED } from "../shared/env.js";
import { createLogger } from "../shared/log.js";

const log = createLogger("popup");
import {
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_PROFILE_BORDER_OPEN,
  SETTINGS_KEYS,
  getLocalSettings,
  setFavoritesEnabled,
  setGeoOverride,
  setProfileBorderOpen,
  type GeoOverride,
  type ProfileBorderOpen,
} from "../shared/settings.js";

let savedProfileBorderOpenInNewTab = DEFAULT_PROFILE_BORDER_OPEN.openInNewTab;

const favoritesDetails = document.getElementById("favorites-details") as HTMLDetailsElement | null;
const favoritesEnabledCheckbox = document.getElementById("favorites-enabled") as HTMLInputElement;
const favoritesHint = document.getElementById("favorites-hint");
const favoritesEnableLabel = document.getElementById("favorites-enable-label");

const randomAccuracy = (): number => Math.round((5 + Math.random() * 20) * 10) / 10;

const openSettingsBtn = document.getElementById("open-settings");
const geoDetails = document.querySelector<HTMLDetailsElement>("details.collapsible");

const profileBorderDetails = document.getElementById(
  "profile-border-details",
) as HTMLDetailsElement | null;
const profileBorderEnabled = document.getElementById("profile-border-enabled") as HTMLInputElement;
const profileBorderTabField = document.getElementById("profile-border-tab-field") as HTMLElement;
const profileBorderTab = document.getElementById("profile-border-tab") as HTMLSelectElement;
const profileBorderOptionCurrent = document.querySelector<HTMLOptionElement>(
  '#profile-border-tab option[value="current-tab"]',
)!;
const profileBorderOptionNew = document.querySelector<HTMLOptionElement>(
  '#profile-border-tab option[value="new-tab"]',
)!;
const profileBorderSave = document.getElementById("profile-border-save");

const geoEnabled = document.getElementById("geo-enabled") as HTMLInputElement;
const geoFields = document.getElementById("geo-fields") as HTMLElement;
const geoLat = document.getElementById("geo-lat") as HTMLInputElement;
const geoLng = document.getElementById("geo-lng") as HTMLInputElement;
const geoAccuracy = document.getElementById("geo-accuracy") as HTMLInputElement;
const geoFillCurrent = document.getElementById("geo-fill-current");
const geoSave = document.getElementById("geo-save");
const geoStatus = document.getElementById("geo-status");

const updateGeoSave = (): void => {
  if (geoSave) {
    geoSave.style.display = geoLat.value.trim() !== "" && geoLng.value.trim() !== "" ? "" : "none";
  }
};

const init = async (): Promise<void> => {
  const settings = await getLocalSettings();
  if (geoDetails) {
    geoDetails.open = settings.geoSectionOpen;
  }
  const geo = { ...DEFAULT_GEO_OVERRIDE, ...settings.geoOverride };
  geoEnabled.checked = geo.enabled;
  geoFields.style.display = geo.enabled ? "" : "none";
  geoLat.value = geo.latitude !== 0 ? String(geo.latitude) : "";
  geoLng.value = geo.longitude !== 0 ? String(geo.longitude) : "";
  geoAccuracy.value = String(geo.accuracy);
  updateGeoSave();

  if (favoritesDetails) {
    favoritesDetails.open = settings.favoritesSectionOpen;
  }
  if (!FAVORITES_NOTIFICATIONS_ENABLED) {
    favoritesEnabledCheckbox.checked = false;
    favoritesEnabledCheckbox.disabled = true;
    if (favoritesHint) {
      favoritesHint.textContent = "Coming soon!";
    }
    if (favoritesEnableLabel) {
      favoritesEnableLabel.style.textDecoration = "line-through";
    }
  } else {
    favoritesEnabledCheckbox.checked = settings.favoritesEnabled;
  }

  if (profileBorderDetails) {
    profileBorderDetails.open = settings.profileBorderSectionOpen;
  }
  const profileBorder = { ...DEFAULT_PROFILE_BORDER_OPEN, ...settings.profileBorderOpen };
  profileBorderEnabled.checked = profileBorder.enabled;
  profileBorderTabField.style.display = profileBorder.enabled ? "" : "none";
  profileBorderTab.value = profileBorder.openInNewTab ? "new-tab" : "current-tab";
  applyProfileBorderLabels(profileBorder.openInNewTab);
  savedProfileBorderOpenInNewTab = profileBorder.openInNewTab;
  if (profileBorderSave) {
    profileBorderSave.style.display = "none";
  }
};

geoDetails?.addEventListener("toggle", () => {
  void chrome.storage.local.set({ [SETTINGS_KEYS.geoSectionOpen]: geoDetails.open });
});

favoritesDetails?.addEventListener("toggle", () => {
  void chrome.storage.local.set({ [SETTINGS_KEYS.favoritesSectionOpen]: favoritesDetails.open });
});

favoritesEnabledCheckbox.addEventListener("change", () => {
  void setFavoritesEnabled(favoritesEnabledCheckbox.checked);
});

profileBorderDetails?.addEventListener("toggle", () => {
  void chrome.storage.local.set({
    [SETTINGS_KEYS.profileBorderSectionOpen]: profileBorderDetails.open,
  });
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

geoEnabled.addEventListener("change", () => {
  geoFields.style.display = geoEnabled.checked ? "" : "none";
  reRandomizeAccuracy();
});

for (const field of [geoLat, geoLng]) {
  field.addEventListener("blur", reRandomizeAccuracy);
  field.addEventListener("input", updateGeoSave);
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
      updateGeoSave();
      if (geoStatus) {
        geoStatus.textContent = "";
      }
    },
    (error) => {
      log("Failed to get current position", error);
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

const PROFILE_BORDER_LABELS = {
  current: "Current tab",
  currentSaved: "Current tab (saved)",
  new: "New tab",
  newSaved: "New tab (saved)",
} as const;

const applyProfileBorderLabels = (openInNewTab: boolean): void => {
  profileBorderOptionCurrent.text = openInNewTab
    ? PROFILE_BORDER_LABELS.current
    : PROFILE_BORDER_LABELS.currentSaved;
  profileBorderOptionNew.text = openInNewTab
    ? PROFILE_BORDER_LABELS.newSaved
    : PROFILE_BORDER_LABELS.new;
};

const readProfileBorderForm = (): ProfileBorderOpen => ({
  enabled: profileBorderEnabled.checked,
  openInNewTab: profileBorderTab.value === "new-tab",
});

profileBorderEnabled.addEventListener("change", () => {
  profileBorderTabField.style.display = profileBorderEnabled.checked ? "" : "none";
  void setProfileBorderOpen(readProfileBorderForm());
});

profileBorderTab.addEventListener("change", () => {
  const isChanged = (profileBorderTab.value === "new-tab") !== savedProfileBorderOpenInNewTab;
  if (profileBorderSave) {
    profileBorderSave.style.display = isChanged ? "" : "none";
  }
});

profileBorderSave?.addEventListener("click", async () => {
  const next = readProfileBorderForm();
  await setProfileBorderOpen(next);
  applyProfileBorderLabels(next.openInNewTab);
  savedProfileBorderOpenInNewTab = next.openInNewTab;
  profileBorderSave.style.display = "none";
});

void init();
