import {
  BOT_BLOCK_CSS,
  BOT_BLOCK_HTML,
  countDistinctBlockedBotsLast24h,
  createLogger,
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_PROFILE_BORDER_OPEN,
  extractTravelDestination,
  GEO_OVERRIDE_CSS,
  GEO_OVERRIDE_HTML,
  hasCapturedCoords,
  ICON_HOLDER_RIGHT_BOTTOM_SELECTOR,
  installCitySearchStatusUI,
  installCitySearchXhrObserver,
  installGeoHook,
  installProfileBorderRedirect,
  installTravelClickArmer,
  PROFILE_BORDER_CSS,
  PROFILE_BORDER_HTML,
  VERSION_BADGE_CSS,
  wireBotBlockForm,
  wireGeoOverrideForm,
  wireProfileBorderForm,
  wireVersionBadge,
  type GeoOverride,
  type ProfileBorderOpen,
} from "@sniffies-projects/core";
import FAB_ICON_PNG from "../../client/icons/icon48.png";
import PANEL_CSS from "./panel.css";
import PANEL_HTML from "./panel.html";
import { installReportFeature, refreshBlockedBotsIfStale, type ReportFeatureState } from "./report.js";
import { REPORTING_ENABLED, VERSION } from "./shared/env.js";
import {
  getBlockedBotEventsByDay,
  getBotBlockingEnabled,
  getBotBlockingSectionOpen,
  getGeoOverride,
  getGeoSectionOpen,
  getProfileBorderOpen,
  getProfileBorderSectionOpen,
  setBotBlockingEnabled,
  setBotBlockingSectionOpen,
  setGeoOverride,
  setGeoSectionOpen,
  setProfileBorderOpen,
  setProfileBorderSectionOpen,
} from "./shared/settings.js";
import { installUserIdLogging } from "./user-id-logger.js";

const log = createLogger("tools");

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
  }
}

// Longest we'll wait for the proactive location push before reloading
// anyway — long enough for a normal request round trip, short enough that a
// hung request doesn't leave the user stuck on the paywall-bound page.
const RELOAD_SAFETY_TIMEOUT_MS = 4000;

// ── FAB mount ─────────────────────────────────────────────────────────────────
// class for buttons that show up on the map
const ICON_HOLDER_ROW_CLASS = "lower-map-icon";
// class for the fab button when mounted on the map
const FAB_DOCKED_CLASS = "snp-fab-docked";
const NGCONTENT_ATTR_PREFIX = "_ngcontent-";

const copyNgContentAttr = (target: Element, source: Element): void => {
  const attr = Array.from(source.attributes).find((a) => a.name.startsWith(NGCONTENT_ATTR_PREFIX));
  if (attr) {
    target.setAttribute(attr.name, attr.value);
  }
};

const mountFab = (fab: HTMLButtonElement): void => {
  const tryInsertIntoIconHolder = (): boolean => {
    const iconHolder = document.querySelector<HTMLElement>(ICON_HOLDER_RIGHT_BOTTOM_SELECTOR);
    if (!iconHolder) return false;
    if (fab.parentElement !== iconHolder) {
      iconHolder.prepend(fab);
      fab.classList.add(ICON_HOLDER_ROW_CLASS, FAB_DOCKED_CLASS);
      copyNgContentAttr(fab, iconHolder);
    }
    return true;
  };

  // Fallback anchor, used until the icon row above first appears.
  if (!tryInsertIntoIconHolder()) {
    document.body.appendChild(fab);
  }

  const observer = new MutationObserver(() => {
    tryInsertIntoIconHolder();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

// ── Hooks (runs at document-start, before page scripts) ──────────────────────

interface HookState {
  currentOverride: GeoOverride;
  sendLocationUpdate: (override: GeoOverride) => Promise<void>;
  /**
   * The single place that mutates the override the fetch/geo hooks read —
   * both automatic captures (travel click, city search) and UI-driven
   * changes (the enabled checkbox, clear button) must go through this so
   * they share one source of truth instead of drifting apart.
   */
  setOverride: (next: GeoOverride) => void;
  /** Registers the UI's listener for locations captured via a native "Travel here" click or city search. */
  subscribeOverrideCapture: (cb: (next: GeoOverride) => void) => void;
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

  let currentOverride: GeoOverride = getGeoOverride();
  // TODO debug?
  log("initial override", currentOverride, { hasLocation: hasCapturedCoords(currentOverride) });
  const hook = installGeoHook(() => currentOverride);

  const nativeFetch = window.fetch.bind(window);
  let lastLocationRequest: { url: string; init: RequestInit } | null = null;
  let apiBase: string | null = null;
  let onOverrideCaptured: ((next: GeoOverride) => void) | null = null;

  // Shared by automatic captures below and by the UI's checkbox/clear
  // actions (wired in mountUI via the returned setOverride) — anything that
  // changes the override must go through here so the fetch hook's own
  // currentOverride.enabled checks never see a stale value.
  const applyOverride = (next: GeoOverride): void => {
    currentOverride = next;
    setGeoOverride(next);
    hook?.refreshWatches();
    onOverrideCaptured?.(next);
  };

  // A city search alone doesn't mean the user wants to travel there yet —
  // they might search around before deciding. So a search only stages a
  // *pending* location (shown next to Sniffies' own search box, not saved
  // anywhere) until they confirm it by clicking "Travel here", same gesture
  // as confirming a dragged pin.
  let pendingSearchOverride: GeoOverride | null = null;
  const citySearchStatusUI = installCitySearchStatusUI();

  const commitPendingSearchOverride = (): void => {
    if (!pendingSearchOverride) {
      return;
    }
    const next = pendingSearchOverride;
    pendingSearchOverride = null;
    citySearchStatusUI.clear();
    log("travel here clicked — committing pending search location", next);
    applyOverride(next);
    // Unlike a dragged-pin confirmation (which reads a PUT Sniffies' own
    // code already sent), picking a city from search never tells Sniffies'
    // server your location changed — it's just a map lookup. So this has to
    // proactively push the new coords itself, or the server (and anything
    // the app derives from it on reload, rather than a fresh geolocation
    // call) stays on the old location.
    //
    // Sniffies' own click handling is still running in parallel (we don't
    // block it), and on this account it eventually bounces to a paywall
    // page rather than ever sending a real location PUT. Reloading here —
    // once our own push has landed, or after a timeout if it hasn't — races
    // that bounce: the user lands back on the map with the new location
    // already active instead of watching the paywall flash by.
    const pushed = sendLocationUpdate(next).catch((err) => {
      log("proactive location update failed", err);
    });
    const timedOut = new Promise<void>((resolve) => setTimeout(resolve, RELOAD_SAFETY_TIMEOUT_MS));
    void Promise.race([pushed, timedOut]).then(() => {
      log("reloading to show the newly confirmed location");
      location.reload();
    });
  };

  // Fires synchronously the moment "Travel here" is clicked, independent of
  // whether a location PUT ever follows (it doesn't, on paywalled
  // accounts) — that's what actually commits a pending search capture.
  const travelArmer = installTravelClickArmer(commitPendingSearchOverride);

  // City search (GET /api/city/{id}) goes through XMLHttpRequest, not fetch
  // — confirmed via DevTools' Initiator stack — so it needs its own patch
  // rather than living inside the window.fetch override below.
  installCitySearchXhrObserver((result) => {
    log("city search response seen (XHR)", { result, spoofingEnabled: currentOverride.enabled });
    // Same enabled-gate as the travel-here capture below — searching a city
    // with spoofing off should behave like normal site usage.
    if (!currentOverride.enabled) {
      log("spoofing not enabled — skipping city search capture");
      return;
    }
    if (result) {
      pendingSearchOverride = {
        enabled: true,
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label,
      };
      log("staged pending search location", pendingSearchOverride);
      citySearchStatusUI.showPending(result.label ?? `${result.latitude}, ${result.longitude}`);
    } else {
      log("city search response had no usable location to capture");
    }
  });

  // Returns a promise so callers that need the request to actually land
  // before doing something else (e.g. reloading the page) can wait for it,
  // instead of firing it and moving on immediately.
  const sendLocationUpdate = (override: GeoOverride): Promise<void> => {
    const spoofed = { lat: override.latitude, lng: override.longitude };
    if (lastLocationRequest) {
      try {
        const body = JSON.parse((lastLocationRequest.init.body as string) ?? "{}") as Record<
          string,
          unknown
        >;
        body.virtualLocation = spoofed;
        body.physicalLocation = spoofed;
        return nativeFetch(lastLocationRequest.url, {
          ...lastLocationRequest.init,
          body: JSON.stringify(body),
        }).then(() => undefined);
      } catch {
        // fall through to proactive request
      }
    }
    if (apiBase) {
      return nativeFetch(`${apiBase}/api/visitor/current/location?state=loaded`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          virtualLocation: spoofed,
          physicalLocation: spoofed,
          homeDistanceInMiles: null,
        }),
      }).then(() => undefined);
    }
    return Promise.resolve();
  };

  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const baseMatch = url.match(/^(https?:\/\/[^/]*sniffies\.com)/);
    if (baseMatch && !apiBase) {
      apiBase = baseMatch[1] ?? null;
    }
    if (url.includes("/api/visitor/current/location")) {
      lastLocationRequest = { url, init: { ...init } };
      const wasArmed = travelArmer.consume();
      log("location PUT seen", { url, wasArmed, spoofingEnabled: currentOverride.enabled });
      // Only capture the picked location while spoofing is turned on — using
      // Sniffies' own Travel Mode with spoofing off should behave like normal
      // site usage, not silently re-enable us.
      if (wasArmed && currentOverride.enabled) {
        try {
          const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
          const captured = extractTravelDestination(body);
          log("parsed travel PUT body", { body, captured });
          if (captured) {
            applyOverride({ enabled: true, ...captured });
            log("saved captured override", currentOverride);
          } else {
            log("armed travel click but PUT body had no virtualLocation to capture", body);
          }
        } catch (err) {
          log("failed to parse/capture travel PUT body", err);
        }
      } else if (currentOverride.enabled && hasCapturedCoords(currentOverride)) {
        try {
          const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
          const spoofed = { lat: currentOverride.latitude, lng: currentOverride.longitude };
          body.virtualLocation = spoofed;
          body.physicalLocation = spoofed;
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          // leave unmodified if parsing fails
        }
      }
    }
    return nativeFetch(input, init);
  };

  let currentProfileBorderOpen: ProfileBorderOpen = getProfileBorderOpen();
  installProfileBorderRedirect(() => currentProfileBorderOpen);
  const updateProfileBorderOpen = (next: ProfileBorderOpen): void => {
    currentProfileBorderOpen = next;
  };

  log("init", {
    version: VERSION,
    reportingBuildFlag: REPORTING_ENABLED,
    geoSpoofing: { enabled: currentOverride.enabled, hasLocation: hasCapturedCoords(currentOverride) },
    profileBorderOpen: currentProfileBorderOpen.enabled,
    botBlocking: reportState.botBlockState.enabled,
  });

  return {
    currentOverride,
    sendLocationUpdate,
    setOverride: applyOverride,
    subscribeOverrideCapture: (cb) => {
      onOverrideCaptured = cb;
    },
    currentProfileBorderOpen,
    updateProfileBorderOpen,
    reportState,
  };
}

// ── UI (runs after DOMContentLoaded) ─────────────────────────────────────────

export function mountUI(state: HookState | null): void {
  const sendLocationUpdate = state?.sendLocationUpdate ?? (() => Promise.resolve());
  const setOverride = state?.setOverride ?? (() => {});
  const subscribeOverrideCapture = state?.subscribeOverrideCapture ?? (() => {});
  const initialOverride = state?.currentOverride ?? { ...DEFAULT_GEO_OVERRIDE };
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

  wireVersionBadge(panel, VERSION);

  const geoRoot = panel.querySelector<HTMLElement>("#snp-geo-root")!;
  geoRoot.innerHTML = GEO_OVERRIDE_HTML;

  const geoFormHandle = wireGeoOverrideForm(geoRoot, {
    initial: initialOverride,
    onSave: (next) => {
      setOverride(next);
      if (next.enabled) {
        void sendLocationUpdate(next);
      }
    },
    onClear: setOverride,
    initialOpen: getGeoSectionOpen(),
    onToggle: setGeoSectionOpen,
  });

  subscribeOverrideCapture((next) => {
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
