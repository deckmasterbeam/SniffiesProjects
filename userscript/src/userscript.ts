import {
  BOT_BLOCK_CSS,
  BOT_BLOCK_HTML,
  countDistinctBlockedBotsLast24h,
  createLogger,
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_PROFILE_BORDER_OPEN,
  GEO_OVERRIDE_CSS,
  GEO_OVERRIDE_HTML,
  getProfileBorderOpen,
  getProfileBorderSectionOpen,
  hasCapturedCoords,
  installLocationOverrideController,
  installProfileBorderRedirect,
  mountFab,
  PANEL_CSS,
  PROFILE_BORDER_CSS,
  PROFILE_BORDER_HTML,
  setProfileBorderOpen,
  setProfileBorderSectionOpen,
  VERSION_BADGE_CSS,
  VERSION_BADGE_HTML,
  wireBotBlockForm,
  wireGeoOverrideForm,
  wireProfileBorderForm,
  wireVersionBadge,
  type LocationOverrideController,
  type ProfileBorderOpen,
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
  getGeoOverride,
  getGeoSectionOpen,
  setBotBlockingEnabled,
  setBotBlockingSectionOpen,
  setGeoOverride,
  setGeoSectionOpen,
} from "./shared/local-storage.js";
import { installUserIdLogging } from "./user-id-logger.js";

const log = createLogger("tools");

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
  }
}

// ── Hooks (runs at document-start, before page scripts) ──────────────────────

interface HookState {
  geoController: LocationOverrideController;
  currentProfileBorderOpen: ProfileBorderOpen;
  updateProfileBorderOpen: (next: ProfileBorderOpen) => void;
  reportState: ReportFeatureState;
}

function installHooks(): HookState {
  const reportState = installReportFeature();
  installUserIdLogging((userId) => {
    reportState.currentSniffiesUserId = userId;
  });
  refreshBlockedBotsIfStale(reportState);

  const geoController = installLocationOverrideController({
    initialOverride: getGeoOverride(),
    onOverrideChanged: setGeoOverride,
  });

  let currentProfileBorderOpen: ProfileBorderOpen = getProfileBorderOpen();
  installProfileBorderRedirect(() => currentProfileBorderOpen);
  const updateProfileBorderOpen = (next: ProfileBorderOpen): void => {
    currentProfileBorderOpen = next;
  };

  const initialOverride = geoController.getOverride();
  log("init", {
    version: VERSION,
    reportingBuildFlag: REPORTING_ENABLED,
    geoSpoofing: {
      enabled: initialOverride.enabled,
      hasLocation: hasCapturedCoords(initialOverride),
    },
    profileBorderOpen: currentProfileBorderOpen.enabled,
    botBlocking: reportState.botBlockState.enabled,
  });

  return {
    geoController,
    currentProfileBorderOpen,
    updateProfileBorderOpen,
    reportState,
  };
}

// ── UI (runs after DOMContentLoaded) ─────────────────────────────────────────

export function mountUI(state: HookState | null): void {
  const geoController = state?.geoController ?? null;
  const updateProfileBorderOpen = state?.updateProfileBorderOpen ?? (() => {});
  const currentProfileBorderOpen = state?.currentProfileBorderOpen ?? {
    ...DEFAULT_PROFILE_BORDER_OPEN,
  };
  const reportState = state?.reportState ?? {
    currentSniffiesUserId: "",
    botBlockState: { blockedIds: new Set<string>(), enabled: true },
  };

  const shellStyle = document.createElement("style");
  shellStyle.textContent = PANEL_CSS;
  document.head.appendChild(shellStyle);

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

  const geoRoot = panel.querySelector<HTMLElement>("#snp-geo-root")!;
  geoRoot.innerHTML = GEO_OVERRIDE_HTML;

  const geoFormHandle = wireGeoOverrideForm(geoRoot, {
    initial: geoController?.getOverride() ?? { ...DEFAULT_GEO_OVERRIDE },
    onSave: (next) => {
      geoController?.setOverride(next);
      if (next.enabled) {
        void geoController?.sendLocationUpdate(next);
      }
    },
    onClear: (next) => geoController?.setOverride(next),
    initialOpen: getGeoSectionOpen(),
    onToggle: setGeoSectionOpen,
  });

  geoController?.subscribeChange((next) => {
    geoFormHandle.setOverride(next);
  });

  const profileBorderRoot = panel.querySelector<HTMLElement>("#snp-profile-border-root")!;
  profileBorderRoot.innerHTML = PROFILE_BORDER_HTML;

  wireProfileBorderForm(profileBorderRoot, {
    initial: currentProfileBorderOpen,
    onSave: (next) => {
      setProfileBorderOpen(next);
      updateProfileBorderOpen(next);
    },
    initialOpen: getProfileBorderSectionOpen(),
    onToggle: setProfileBorderSectionOpen,
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
