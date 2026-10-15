import {
  BOT_BLOCK_CSS,
  BOT_BLOCK_HTML,
  countDistinctBlockedBotsLast24h,
  createLogger,
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_PROFILE_BORDER_OPEN,
  PREMIUM_FEATURES_CSS,
  PREMIUM_FEATURES_HTML,
  UPDATE_BANNER_CSS,
  UPDATE_BANNER_HTML,
  VERSION_BADGE_CSS,
  VERSION_BADGE_HTML,
  wireUpdateBanner,
  wireVersionBadge,
  wirePremiumFeaturesForm,
  wireBotBlockForm,
  PROFILE_FILTERS_HTML,
  PROFILE_FILTERS_CSS,
  wireProfileFiltersForm,
} from "@sniffies-projects/core";
import { DEBUG, FAVORITES_NOTIFICATIONS_ENABLED, REPORTING_ENABLED } from "../shared/env.js";
import {
  getLocalSettings,
  setBotBlockingEnabled,
  setBotBlockingSectionOpen,
  setFavoritesEnabled,
  setFavoritesSectionOpen,
  setGeoOverride,
  setPremiumFeatureFlags,
  setPremiumFeaturesEnabled,
  setPremiumSectionOpen,
  setProfileBorderOpen,
  setProfileFiltersEnabled,
  setProfileFiltersSectionOpen,
} from "../shared/settings.js";

const log = createLogger("popup");

// Inject premium features form, bot-block form, profile filters form, and version badge styles from core
const premiumStyle = document.createElement("style");
premiumStyle.textContent = PREMIUM_FEATURES_CSS;
document.head.appendChild(premiumStyle);

const botBlockStyle = document.createElement("style");
botBlockStyle.textContent = BOT_BLOCK_CSS;
document.head.appendChild(botBlockStyle);

const profileFiltersStyle = document.createElement("style");
profileFiltersStyle.textContent = PROFILE_FILTERS_CSS;
document.head.appendChild(profileFiltersStyle);

const versionStyle = document.createElement("style");
versionStyle.textContent = VERSION_BADGE_CSS;
document.head.appendChild(versionStyle);

const updateBannerStyle = document.createElement("style");
updateBannerStyle.textContent = UPDATE_BANNER_CSS;
document.head.appendChild(updateBannerStyle);

// ── Element references ────────────────────────────────────────────────────────

const favoritesDetails = document.getElementById("favorites-details") as HTMLDetailsElement | null;
const favoritesEnabledCheckbox = document.getElementById("favorites-enabled") as HTMLInputElement;

const openSettingsBtn = document.getElementById("open-settings");
// The settings page is a debug tool.
if (!DEBUG && openSettingsBtn) {
  openSettingsBtn.style.display = "none";
}

// ── Init ─────────────────────────────────────────────────────────────────────

const init = async (): Promise<void> => {
  const settings = await getLocalSettings();

  const versionRoot = document.getElementById("snp-version-root")!;
  versionRoot.innerHTML = VERSION_BADGE_HTML;
  wireVersionBadge(versionRoot, chrome.runtime.getManifest().version);

  const updateRoot = document.getElementById("snp-update-root")!;
  updateRoot.innerHTML = UPDATE_BANNER_HTML;
  wireUpdateBanner(updateRoot, "chrome", chrome.runtime.getManifest().version);

  // Premium features form — inject HTML from core and wire up logic
  const premiumRoot = document.getElementById("snp-premium-root")!;
  premiumRoot.innerHTML = PREMIUM_FEATURES_HTML;
  let premiumFlags = { ...settings.premiumFeatureFlags };
  wirePremiumFeaturesForm(premiumRoot, {
    initialEnabled: settings.premiumFeaturesEnabled,
    onToggleEnabled: setPremiumFeaturesEnabled,
    flags: premiumFlags,
    onFlagChange: (key, enabled) => {
      premiumFlags = { ...premiumFlags, [key]: enabled };
      return setPremiumFeatureFlags(premiumFlags);
    },
    hasPlus: settings.hasPlus,
    geo: {
      initial: { ...DEFAULT_GEO_OVERRIDE, ...settings.geoOverride },
      onClear: setGeoOverride,
    },
    border: {
      initial: { ...DEFAULT_PROFILE_BORDER_OPEN, ...settings.profileBorderOpen },
      onSave: setProfileBorderOpen,
    },
    initialOpen: settings.premiumSectionOpen,
    onToggle: (open) => {
      void setPremiumSectionOpen(open);
    },
  });

  // Favorites
  if (favoritesDetails) {
    favoritesDetails.open = settings.favoritesSectionOpen;
  }
  if (!FAVORITES_NOTIFICATIONS_ENABLED) {
    // style.display rather than `hidden`: details.collapsible sets display: block.
    if (favoritesDetails) {
      favoritesDetails.style.display = "none";
    }
  } else {
    favoritesEnabledCheckbox.checked = settings.favoritesEnabled;
  }

  // Bot blocking form — inject HTML from core and wire up logic
  const botBlockRoot = document.getElementById("snp-bot-block-root")!;
  botBlockRoot.innerHTML = BOT_BLOCK_HTML;
  wireBotBlockForm(botBlockRoot, {
    reportingEnabled: REPORTING_ENABLED,
    userEnabledReporting: settings.botBlockingEnabled,
    initialCount: countDistinctBlockedBotsLast24h(settings.blockedBotEventsByDay),
    initialOpen: settings.botBlockingSectionOpen,
    onToggle: (open) => {
      void setBotBlockingSectionOpen(open);
    },
    onToggleEnabled: setBotBlockingEnabled,
  });

  // Profile filters form — inject HTML from core and wire up logic
  const profileFiltersRoot = document.getElementById("snp-profile-filters-root")!;
  profileFiltersRoot.innerHTML = PROFILE_FILTERS_HTML;
  wireProfileFiltersForm(profileFiltersRoot, {
    initialEnabled: settings.profileFiltersEnabled,
    onToggleEnabled: setProfileFiltersEnabled,
    initialOpen: settings.profileFiltersSectionOpen,
    onToggle: (open) => {
      void setProfileFiltersSectionOpen(open);
    },
  });
};

// ── Event listeners ───────────────────────────────────────────────────────────

favoritesDetails?.addEventListener("toggle", () => {
  void setFavoritesSectionOpen(favoritesDetails.open);
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
