// Sniffies bookmarklet injection script
// Bookmarklet loader:
//   javascript:(function(){var s=document.createElement('script');s.src='https://YOUR_VERCEL_URL/inject.js?t='+Date.now();document.head.appendChild(s);})();

import {
  getPremiumFeatureFlags,
  getPremiumFeaturesEnabled,
  getPremiumSectionOpen,
  getProfileBorderOpen,
  getProfileFiltersEnabled,
  getProfileFiltersSectionOpen,
  installHidePhotoClick,
  installHidePhotoMenuButtons,
  installProfileBorderRedirect,
  installSentPhotoHider,
  installSelectionLimitOverride,
  mountFab,
  PANEL_CSS,
  UPDATE_BANNER_CSS,
  UPDATE_BANNER_HTML,
  VERSION_BADGE_CSS,
  VERSION_BADGE_HTML,
  wireVersionBadge,
  wireUpdateBanner,
  PREMIUM_FEATURES_CSS,
  PREMIUM_FEATURES_HTML,
  PROFILE_FILTERS_CSS,
  PROFILE_FILTERS_HTML,
  setPremiumFeatureFlags,
  setPremiumFeaturesEnabled,
  setPremiumSectionOpen,
  setProfileBorderOpen,
  setProfileFiltersEnabled,
  setProfileFiltersSectionOpen,
  wirePremiumFeaturesForm,
  wireProfileFiltersForm,
} from "@sniffies-projects/core";
import FAB_ICON_PNG from "../../client/icons/icon48.png";
import PANEL_HTML from "./panel.html";

// ── Guard ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  if (!location.hostname.endsWith("sniffies.com")) {
    return;
  }
  alert("Sniffies Tools loaded! Tap the Sniffies Tools button on the map to open the panel.");

  let currentProfileBorderOpen = getProfileBorderOpen();
  let premiumEnabled = getPremiumFeaturesEnabled();
  let premiumFlags = getPremiumFeatureFlags();
  installProfileBorderRedirect(
    () => currentProfileBorderOpen,
    () => premiumEnabled && premiumFlags.boundary,
  );

  const isPhotosEnabled = (): boolean => premiumEnabled && premiumFlags.photos;
  installHidePhotoClick(
    installSentPhotoHider(() => ""),
    isPhotosEnabled,
  );
  installHidePhotoMenuButtons(isPhotosEnabled);

  // Takes effect the next time the filter menu is opened. The other profile filters need to hook
  // the page's network requests from the start, which a bookmarklet can't.
  let profileFiltersEnabled = getProfileFiltersEnabled();
  installSelectionLimitOverride(() => profileFiltersEnabled);

  // Inject shell styles (FAB + panel chrome)
  const shellStyle = document.createElement("style");
  shellStyle.textContent = PANEL_CSS;
  document.head.appendChild(shellStyle);

  const versionStyle = document.createElement("style");
  versionStyle.textContent = VERSION_BADGE_CSS;
  document.head.appendChild(versionStyle);

  const updateBannerStyle = document.createElement("style");
  updateBannerStyle.textContent = UPDATE_BANNER_CSS;
  document.head.appendChild(updateBannerStyle);

  const premiumStyle = document.createElement("style");
  premiumStyle.textContent = PREMIUM_FEATURES_CSS;
  document.head.appendChild(premiumStyle);

  const profileFiltersStyle = document.createElement("style");
  profileFiltersStyle.textContent = PROFILE_FILTERS_CSS;
  document.head.appendChild(profileFiltersStyle);

  // Inject trigger button into the map's icon row
  const fab = document.createElement("button");
  fab.id = "snp-fab";
  fab.title = "Sniffies Tools";
  const fabIcon = document.createElement("i");
  fabIcon.id = "snp-fab-icon";
  fabIcon.classList.add("fa", "snp-fab-icon-base-size");
  fabIcon.style.backgroundImage = `url("${FAB_ICON_PNG}")`;
  fab.appendChild(fabIcon);
  mountFab(fab);

  // Inject panel shell
  const panel = document.createElement("div");
  panel.id = "snp-panel";
  panel.style.display = "none";
  panel.innerHTML = PANEL_HTML;
  document.body.appendChild(panel);

  const versionRoot = panel.querySelector<HTMLElement>("#snp-version-root")!;
  versionRoot.innerHTML = VERSION_BADGE_HTML;
  wireVersionBadge(versionRoot, __VERSION__);

  const updateRoot = panel.querySelector<HTMLElement>("#snp-update-root")!;
  updateRoot.innerHTML = UPDATE_BANNER_HTML;
  wireUpdateBanner(updateRoot, "bookmarklet", __VERSION__);

  // Location spoofing isn't supported here (it has to hook the page before it loads), and a
  // bookmarklet runs too late to see whether the account has Plus.
  const premiumRoot = panel.querySelector<HTMLElement>("#snp-premium-root")!;
  premiumRoot.innerHTML = PREMIUM_FEATURES_HTML;

  wirePremiumFeaturesForm(premiumRoot, {
    initialEnabled: premiumEnabled,
    onToggleEnabled: (enabled) => {
      setPremiumFeaturesEnabled(enabled);
      premiumEnabled = enabled;
    },
    flags: premiumFlags,
    onFlagChange: (key, enabled) => {
      premiumFlags = { ...premiumFlags, [key]: enabled };
      setPremiumFeatureFlags(premiumFlags);
    },
    hasPlus: null,
    border: {
      initial: currentProfileBorderOpen,
      onSave: (next) => {
        setProfileBorderOpen(next);
        currentProfileBorderOpen = next;
      },
    },
    initialOpen: getPremiumSectionOpen(),
    onToggle: setPremiumSectionOpen,
  });

  const profileFiltersRoot = panel.querySelector<HTMLElement>("#snp-profile-filters-root")!;
  profileFiltersRoot.innerHTML = PROFILE_FILTERS_HTML;

  wireProfileFiltersForm(profileFiltersRoot, {
    hint: 'Lifts the "Choose up to 3" cap on Sniffies\' own Sexuality, Body Type and Position filters. Reopen the Map Layers menu after changing this.',
    initialEnabled: profileFiltersEnabled,
    onToggleEnabled: (enabled) => {
      setProfileFiltersEnabled(enabled);
      profileFiltersEnabled = enabled;
    },
    initialOpen: getProfileFiltersSectionOpen(),
    onToggle: setProfileFiltersSectionOpen,
  });

  // Shell interaction
  const closeBtn = panel.querySelector<HTMLButtonElement>("#snp-close")!;
  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (window.__sniffiesInjected) {
  const panel = document.getElementById("snp-panel");
  if (panel) {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  }
} else {
  window.__sniffiesInjected = true;
  main();
}
