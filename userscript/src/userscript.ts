import {
  BOT_BLOCK_CSS,
  BOT_BLOCK_HTML,
  countDistinctBlockedBotsLast24h,
  createLogger,
  DEFAULT_PROFILE_FILTERS,
  DEFAULT_GEO_OVERRIDE,
  getHasPlus,
  getPremiumFeatureFlags,
  getPremiumFeaturesEnabled,
  getPremiumSectionOpen,
  hasCapturedCoords,
  installHidePhotoClick,
  installHidePhotoMenuButtons,
  installSentPhotoHider,
  installProfileFiltersMenu,
  installSelectionLimitOverride,
  installLocationOverrideController,
  installPlusHook,
  mountFab,
  PANEL_CSS,
  PREMIUM_FEATURES_CSS,
  PREMIUM_FEATURES_HTML,
  PROFILE_FILTERS_CSS,
  PROFILE_FILTERS_HTML,
  setHasPlus,
  setPremiumFeatureFlags,
  setPremiumFeaturesEnabled,
  setPremiumSectionOpen,
  VERSION_BADGE_CSS,
  VERSION_BADGE_HTML,
  wireBotBlockForm,
  wirePremiumFeaturesForm,
  wireProfileFiltersForm,
  wireVersionBadge,
  UPDATE_BANNER_CSS,
  UPDATE_BANNER_HTML,
  wireUpdateBanner,
  type LocationOverrideController,
  type PremiumFeatureFlags,
} from "@sniffies-projects/core";
import FAB_ICON_PNG from "../../client/icons/icon48.png";
import PANEL_HTML from "./panel.html";
import {
  installReportFeature,
  refreshBlockedBotsIfStale,
  type ReportFeatureState,
} from "./report.js";
import { REPORTING_ENABLED, VERSION } from "./shared/env.js";
import {
  getBlockedBotEventsByDay,
  getBotBlockingEnabled,
  getBotBlockingSectionOpen,
  getProfileFilters,
  getGeoOverride,
  getProfileFiltersEnabled,
  getProfileFiltersSectionOpen,
  setBotBlockingEnabled,
  setBotBlockingSectionOpen,
  setProfileFilters,
  setGeoOverride,
  setProfileFiltersEnabled,
  setProfileFiltersSectionOpen,
} from "./shared/local-storage.js";
import { installUserIdLogging } from "./user-id-logger.js";

const log = createLogger("tools");

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
  }
}

// ── Hooks (runs at document-start, before page scripts) ──────────────────────

interface PremiumState {
  enabled: boolean;
  flags: PremiumFeatureFlags;
}

const readPremium = (): PremiumState => ({
  enabled: getPremiumFeaturesEnabled(),
  flags: getPremiumFeatureFlags(),
});

interface HookState {
  premium: PremiumState;
  geoController: LocationOverrideController;
  reportState: ReportFeatureState;
}

function installHooks(): HookState {
  const premium = readPremium();
  const reportState = installReportFeature(() => premium.enabled && premium.flags.boundary);
  installUserIdLogging((userId) => {
    reportState.currentSniffiesUserId = userId;
  });
  refreshBlockedBotsIfStale(reportState);
  installSelectionLimitOverride(getProfileFiltersEnabled);
  installPlusHook(setHasPlus);

  // Each premium hook is live only while the master switch and its own switch are both on.
  const isPhotosEnabled = (): boolean => premium.enabled && premium.flags.photos;
  installHidePhotoClick(
    installSentPhotoHider(() => reportState.currentSniffiesUserId),
    isPhotosEnabled,
  );
  installHidePhotoMenuButtons(isPhotosEnabled);

  const geoController = installLocationOverrideController({
    initialOverride: getGeoOverride(),
    isPremiumEnabled: () => premium.enabled && premium.flags.location,
    onOverrideChanged: setGeoOverride,
  });

  const initialOverride = geoController.getOverride();
  log("init", {
    version: VERSION,
    reportingBuildFlag: REPORTING_ENABLED,
    premiumFeatures: premium.enabled,
    geoSpoofing: {
      hasLocation: hasCapturedCoords(initialOverride),
    },
    botBlocking: reportState.botBlockState.enabled,
    profileFilters: reportState.appliedProfileFilters,
  });

  return {
    premium,
    geoController,
    reportState,
  };
}

// ── UI (runs after DOMContentLoaded) ─────────────────────────────────────────

export function mountUI(state: HookState | null): void {
  const premium = state?.premium ?? readPremium();
  const geoController = state?.geoController ?? null;
  const reportState = state?.reportState ?? {
    currentSniffiesUserId: "",
    botBlockState: { blockedIds: new Set<string>(), enabled: true },
    appliedProfileFilters: DEFAULT_PROFILE_FILTERS,
  };

  const shellStyle = document.createElement("style");
  shellStyle.textContent = PANEL_CSS;
  document.head.appendChild(shellStyle);

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

  const fab = document.createElement("button");
  fab.id = "snp-fab";
  fab.title = "Sniffies Tools";
  const fabIcon = document.createElement("i");
  fabIcon.id = "snp-fab-icon";
  fabIcon.classList.add("fa", "snp-fab-icon-base-size");
  fabIcon.style.backgroundImage = `url("${FAB_ICON_PNG}")`;
  fab.appendChild(fabIcon);
  mountFab(fab);

  const panel = document.createElement("div");
  panel.id = "snp-panel";
  panel.style.display = "none";
  panel.innerHTML = PANEL_HTML;
  document.body.appendChild(panel);

  const versionRoot = panel.querySelector<HTMLElement>("#snp-version-root")!;
  versionRoot.innerHTML = VERSION_BADGE_HTML;
  wireVersionBadge(versionRoot, VERSION);

  const updateRoot = panel.querySelector<HTMLElement>("#snp-update-root")!;
  updateRoot.innerHTML = UPDATE_BANNER_HTML;
  wireUpdateBanner(updateRoot, "userscript", VERSION);

  const premiumRoot = panel.querySelector<HTMLElement>("#snp-premium-root")!;
  premiumRoot.innerHTML = PREMIUM_FEATURES_HTML;

  // Re-run the spoof (or un-spoof) on any active location watches.
  const resyncLocation = (): void => {
    if (geoController) {
      geoController.syncOverride(geoController.getOverride());
      if (
        premium.enabled &&
        premium.flags.location &&
        hasCapturedCoords(geoController.getOverride())
      ) {
        void geoController.sendLocationUpdate(geoController.getOverride());
      }
    }
  };

  const premiumFormHandle = wirePremiumFeaturesForm(premiumRoot, {
    initialEnabled: premium.enabled,
    onToggleEnabled: (enabled) => {
      setPremiumFeaturesEnabled(enabled);
      premium.enabled = enabled;
      resyncLocation();
    },
    flags: premium.flags,
    onFlagChange: (key, enabled) => {
      premium.flags = { ...premium.flags, [key]: enabled };
      setPremiumFeatureFlags(premium.flags);
      if (key === "location") {
        resyncLocation();
      }
    },
    hasPlus: getHasPlus(),
    geo: {
      initial: geoController?.getOverride() ?? { ...DEFAULT_GEO_OVERRIDE },
      onClear: (next) => geoController?.setOverride(next),
    },
    initialOpen: getPremiumSectionOpen(),
    onToggle: setPremiumSectionOpen,
  });

  geoController?.subscribeChange((next) => {
    premiumFormHandle.setOverride(next);
  });

  const botBlockRoot = panel.querySelector<HTMLElement>("#snp-bot-block-root")!;
  botBlockRoot.innerHTML = BOT_BLOCK_HTML;

  wireBotBlockForm(botBlockRoot, {
    reportingEnabled: REPORTING_ENABLED,
    userEnabledReporting: getBotBlockingEnabled(),
    initialCount: countDistinctBlockedBotsLast24h(getBlockedBotEventsByDay()),
    initialOpen: getBotBlockingSectionOpen(),
    onToggle: setBotBlockingSectionOpen,
    onToggleEnabled: (enabled) => {
      setBotBlockingEnabled(enabled);
      reportState.botBlockState = { ...reportState.botBlockState, enabled };
    },
  });

  const profileFiltersRoot = panel.querySelector<HTMLElement>("#snp-profile-filters-root")!;
  profileFiltersRoot.innerHTML = PROFILE_FILTERS_HTML;

  let removeFiltersMenu: (() => void) | null = null;
  const syncFiltersMenu = (enabled: boolean): void => {
    if (enabled && !removeFiltersMenu) {
      removeFiltersMenu = installProfileFiltersMenu({
        initial: getProfileFilters(),
        applied: reportState.appliedProfileFilters,
        onChange: setProfileFilters,
      });
    } else if (!enabled && removeFiltersMenu) {
      removeFiltersMenu();
      removeFiltersMenu = null;
    }
  };
  syncFiltersMenu(getProfileFiltersEnabled());

  wireProfileFiltersForm(profileFiltersRoot, {
    initialEnabled: getProfileFiltersEnabled(),
    onToggleEnabled: (enabled) => {
      setProfileFiltersEnabled(enabled);
      syncFiltersMenu(enabled);
    },
    initialOpen: getProfileFiltersSectionOpen(),
    onToggle: setProfileFiltersSectionOpen,
  });

  const closeBtn = panel.querySelector<HTMLButtonElement>("#snp-close")!;
  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Must run after all const declarations above are initialized.

if (window.__sniffiesInjected) {
  // Already installed — nothing to do.
} else {
  window.__sniffiesInjected = true;
  let hookState: HookState | null = null;
  try {
    hookState = installHooks();
  } catch (err) {
    log.error("hook install failed:", err);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountUI(hookState), { once: true });
  } else {
    mountUI(hookState);
  }
}
