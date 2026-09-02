import {
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_PROFILE_BORDER_OPEN,
  GEO_OVERRIDE_CSS,
  GEO_OVERRIDE_HTML,
  PROFILE_BORDER_CSS,
  PROFILE_BORDER_HTML,
  wireGeoOverrideForm,
  VERSION_BADGE_CSS,
  wireVersionBadge,
  wireProfileBorderForm,
  createLogger,
  countDistinctBlockedBotsLast24h,
  BOT_BLOCK_HTML,
  BOT_BLOCK_CSS,
  wireBotBlockForm,
} from "@sniffies-projects/core";
import { FAVORITES_NOTIFICATIONS_ENABLED, REPORTING_ENABLED } from "../shared/env.js";
import {
  SETTINGS_KEYS,
  getLocalSettings,
  setBotBlockingEnabled,
  setFavoritesEnabled,
  setGeoOverride,
  setProfileBorderOpen,
} from "../shared/settings.js";

const log = createLogger("popup");

// Inject geo form, profile border form, bot-block form, and version badge styles from core
const geoStyle = document.createElement("style");
geoStyle.textContent = GEO_OVERRIDE_CSS;
document.head.appendChild(geoStyle);

const profileBorderStyle = document.createElement("style");
profileBorderStyle.textContent = PROFILE_BORDER_CSS;
document.head.appendChild(profileBorderStyle);

const botBlockStyle = document.createElement("style");
botBlockStyle.textContent = BOT_BLOCK_CSS;
document.head.appendChild(botBlockStyle);

const versionStyle = document.createElement("style");
versionStyle.textContent = VERSION_BADGE_CSS;
document.head.appendChild(versionStyle);

// ── Element references ────────────────────────────────────────────────────────

const favoritesDetails = document.getElementById("favorites-details") as HTMLDetailsElement | null;
const favoritesEnabledCheckbox = document.getElementById("favorites-enabled") as HTMLInputElement;
const favoritesHint = document.getElementById("favorites-hint");
const favoritesEnableLabel = document.getElementById("favorites-enable-label");

const openSettingsBtn = document.getElementById("open-settings");

// ── Init ─────────────────────────────────────────────────────────────────────

const init = async (): Promise<void> => {
  const settings = await getLocalSettings();

  wireVersionBadge(document.body, chrome.runtime.getManifest().version);

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

  // Profile border form — inject HTML from core and wire up logic
  const profileBorderRoot = document.getElementById("snp-profile-border-root")!;
  profileBorderRoot.innerHTML = PROFILE_BORDER_HTML;
  wireProfileBorderForm(profileBorderRoot, {
    initial: { ...DEFAULT_PROFILE_BORDER_OPEN, ...settings.profileBorderOpen },
    onSave: setProfileBorderOpen,
    initialOpen: settings.profileBorderSectionOpen,
    onToggle: (open) => {
      void chrome.storage.local.set({ [SETTINGS_KEYS.profileBorderSectionOpen]: open });
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

  // Bot blocking form — inject HTML from core and wire up logic
  const botBlockRoot = document.getElementById("snp-bot-block-root")!;
  botBlockRoot.innerHTML = BOT_BLOCK_HTML;
  wireBotBlockForm(botBlockRoot, {
    reportingEnabled: REPORTING_ENABLED,
    initialEnabled: settings.botBlockingEnabled,
    initialCount: countDistinctBlockedBotsLast24h(settings.blockedBotEventsByDay),
    initialOpen: settings.botBlockingSectionOpen,
    onToggle: (open) => {
      void chrome.storage.local.set({ [SETTINGS_KEYS.botBlockingSectionOpen]: open });
    },
    onToggleEnabled: setBotBlockingEnabled,
  });
};

// ── Event listeners ───────────────────────────────────────────────────────────

favoritesDetails?.addEventListener("toggle", () => {
  void chrome.storage.local.set({ [SETTINGS_KEYS.favoritesSectionOpen]: favoritesDetails.open });
});

favoritesEnabledCheckbox.addEventListener("change", () => {
  void setFavoritesEnabled(favoritesEnabledCheckbox.checked);
});

openSettingsBtn?.addEventListener("click", () => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("src/settings/settings.html"),
  });
  window.close();
});

log("popup loaded");

void init();
