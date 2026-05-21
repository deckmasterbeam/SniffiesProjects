import {
  DEFAULT_GEO_OVERRIDE,
  GEO_OVERRIDE_CSS,
  GEO_OVERRIDE_HTML,
  wireGeoOverrideForm,
} from "@sniffies-projects/core";
import { FAVORITES_NOTIFICATIONS_ENABLED } from "../shared/env.js";
import { createLogger } from "../shared/log.js";
import {
  DEFAULT_PROFILE_BORDER_OPEN,
  SETTINGS_KEYS,
  getLocalSettings,
  setFavoritesEnabled,
  setGeoOverride,
  setProfileBorderOpen,
  type ProfileBorderOpen,
} from "../shared/settings.js";

const log = createLogger("popup");

// Inject geo form styles from core
const geoStyle = document.createElement("style");
geoStyle.textContent = GEO_OVERRIDE_CSS;
document.head.appendChild(geoStyle);

// ── Element references ────────────────────────────────────────────────────────

let savedProfileBorderOpenInNewTab = DEFAULT_PROFILE_BORDER_OPEN.openInNewTab;

const favoritesDetails = document.getElementById("favorites-details") as HTMLDetailsElement | null;
const favoritesEnabledCheckbox = document.getElementById("favorites-enabled") as HTMLInputElement;
const favoritesHint = document.getElementById("favorites-hint");
const favoritesEnableLabel = document.getElementById("favorites-enable-label");

const openSettingsBtn = document.getElementById("open-settings");

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

// ── Init ─────────────────────────────────────────────────────────────────────

const init = async (): Promise<void> => {
  const settings = await getLocalSettings();

  // Geo form — inject HTML from core and wire up logic
  const geoRoot = document.getElementById("snp-geo-root")!;
  geoRoot.innerHTML = GEO_OVERRIDE_HTML;
  wireGeoOverrideForm(geoRoot, {
    initial: { ...DEFAULT_GEO_OVERRIDE, ...settings.geoOverride },
    onSave: setGeoOverride,
    getNativePosition: navigator.geolocation.getCurrentPosition.bind(navigator.geolocation),
    initialOpen: settings.geoSectionOpen,
    onToggle: (open) => {
      void chrome.storage.local.set({ [SETTINGS_KEYS.geoSectionOpen]: open });
    },
  });

  // Favorites
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

  // Profile border
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

// ── Event listeners ───────────────────────────────────────────────────────────

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

// ── Profile border ────────────────────────────────────────────────────────────

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

log("popup loaded");

void init();
