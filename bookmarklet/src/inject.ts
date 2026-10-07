// Sniffies bookmarklet injection script
// Bookmarklet loader:
//   javascript:(function(){var s=document.createElement('script');s.src='https://YOUR_VERCEL_URL/inject.js?t='+Date.now();document.head.appendChild(s);})();

import {
  getProfileBorderOpen,
  getProfileBorderSectionOpen,
  getProfileFiltersEnabled,
  getProfileFiltersSectionOpen,
  installProfileBorderRedirect,
  installSelectionLimitOverride,
  mountFab,
  PANEL_CSS,
  PROFILE_BORDER_CSS,
  PROFILE_BORDER_HTML,
  PROFILE_FILTERS_CSS,
  PROFILE_FILTERS_HTML,
  setProfileBorderOpen,
  setProfileBorderSectionOpen,
  setProfileFiltersEnabled,
  setProfileFiltersSectionOpen,
  wireProfileBorderForm,
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
  installProfileBorderRedirect(() => currentProfileBorderOpen);

  // Takes effect the next time the filter menu is opened. The other profile filters need to hook
  // the page's network requests from the start, which a bookmarklet can't.
  let profileFiltersEnabled = getProfileFiltersEnabled();
  installSelectionLimitOverride(() => profileFiltersEnabled);

  // Inject shell styles (FAB + panel chrome)
  const shellStyle = document.createElement("style");
  shellStyle.textContent = PANEL_CSS;
  document.head.appendChild(shellStyle);

  const profileBorderStyle = document.createElement("style");
  profileBorderStyle.textContent = PROFILE_BORDER_CSS;
  document.head.appendChild(profileBorderStyle);

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

  const profileBorderRoot = panel.querySelector<HTMLElement>("#snp-profile-border-root")!;
  profileBorderRoot.innerHTML = PROFILE_BORDER_HTML;

  wireProfileBorderForm(profileBorderRoot, {
    initial: currentProfileBorderOpen,
    onSave: (next) => {
      setProfileBorderOpen(next);
      currentProfileBorderOpen = next;
    },
    initialOpen: getProfileBorderSectionOpen(),
    onToggle: setProfileBorderSectionOpen,
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
