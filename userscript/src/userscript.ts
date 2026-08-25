// Sniffies Tools — iOS userscript
// Install via a userscript manager app (e.g. Userscripts, Stay) that supports
// the ==UserScript== metadata format. The metadata header is prepended by the
// build script; this file contains only the runtime logic.

import {
  installGeoHook,
  type GeoOverride,
  DEFAULT_GEO_OVERRIDE,
  GEO_OVERRIDE_HTML,
  GEO_OVERRIDE_CSS,
  wireGeoOverrideForm,
  VERSION_BADGE_CSS,
  wireVersionBadge,
  installProfileBorderRedirect,
  type ProfileBorderOpen,
  DEFAULT_PROFILE_BORDER_OPEN,
  PROFILE_BORDER_HTML,
  PROFILE_BORDER_CSS,
  wireProfileBorderForm,
  createLogger,
} from "@sniffies-projects/core";
import PANEL_CSS from "./panel.css";
import PANEL_HTML from "./panel.html";
import {
  getGeoOverride,
  setGeoOverride,
  getProfileBorderOpen,
  setProfileBorderOpen,
} from "./shared/settings.js";
import { installUserIdLogging } from "./user-id-logger.js";
import { VERSION } from "./shared/env.js";

const log = createLogger("tools");

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
  }
}

// ── FAB mount ─────────────────────────────────────────────────────────────────

const mountFab = (fab: HTMLButtonElement): void => {
  const tryInsert = (): boolean => {
    const navTarget = document.querySelector<HTMLElement>('[title="Sitelinks"]');
    if (navTarget?.parentElement) {
      navTarget.parentElement.insertBefore(fab, navTarget.nextSibling);
      return true;
    }
    return false;
  };

  if (tryInsert()) return;

  const observer = new MutationObserver(() => {
    if (tryInsert()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

// ── Hooks (runs at document-start, before page scripts) ──────────────────────

interface HookState {
  currentOverride: GeoOverride;
  hook: ReturnType<typeof installGeoHook>;
  nativeGetCurrentPosition: Geolocation["getCurrentPosition"];
  sendLocationUpdate: (override: GeoOverride) => void;
  currentProfileBorderOpen: ProfileBorderOpen;
  updateProfileBorderOpen: (next: ProfileBorderOpen) => void;
}

function installHooks(): HookState {
  installUserIdLogging();

  let currentOverride: GeoOverride = getGeoOverride();
  const hook = installGeoHook(() => currentOverride);
  const nativeGetCurrentPosition =
    hook?.nativeGetCurrentPosition ??
    navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);

  const nativeFetch = window.fetch.bind(window);
  let lastLocationRequest: { url: string; init: RequestInit } | null = null;
  let apiBase: string | null = null;

  const sendLocationUpdate = (override: GeoOverride): void => {
    const spoofed = { lat: override.latitude, lng: override.longitude };
    if (lastLocationRequest) {
      try {
        const body = JSON.parse((lastLocationRequest.init.body as string) ?? "{}") as Record<
          string,
          unknown
        >;
        body.virtualLocation = spoofed;
        body.physicalLocation = spoofed;
        void nativeFetch(lastLocationRequest.url, {
          ...lastLocationRequest.init,
          body: JSON.stringify(body),
        });
        return;
      } catch {
        // fall through to proactive request
      }
    }
    if (apiBase) {
      void nativeFetch(`${apiBase}/api/visitor/current/location?state=loaded`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          virtualLocation: spoofed,
          physicalLocation: spoofed,
          homeDistanceInMiles: null,
        }),
      });
    }
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
      if (currentOverride.enabled) {
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

  return {
    currentOverride,
    hook,
    nativeGetCurrentPosition,
    sendLocationUpdate,
    currentProfileBorderOpen,
    updateProfileBorderOpen,
  };
}

// ── UI (runs after DOMContentLoaded) ─────────────────────────────────────────

export function mountUI(state: HookState | null): void {
  const hook = state?.hook ?? null;
  const nativeGetCurrentPosition =
    state?.nativeGetCurrentPosition ??
    (() => {
      throw new Error("geolocation unavailable");
    });
  const sendLocationUpdate = state?.sendLocationUpdate ?? (() => {});
  let currentOverride = state?.currentOverride ?? { ...DEFAULT_GEO_OVERRIDE };
  const updateProfileBorderOpen = state?.updateProfileBorderOpen ?? (() => {});
  const currentProfileBorderOpen = state?.currentProfileBorderOpen ?? {
    ...DEFAULT_PROFILE_BORDER_OPEN,
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

  const versionStyle = document.createElement("style");
  versionStyle.textContent = VERSION_BADGE_CSS;
  document.head.appendChild(versionStyle);

  const fab = document.createElement("button");
  fab.id = "snp-fab";
  fab.title = "Sniffies Tools";
  fab.textContent = "📍";
  mountFab(fab);

  const panel = document.createElement("div");
  panel.id = "snp-panel";
  panel.style.display = "none";
  panel.innerHTML = PANEL_HTML;
  document.body.appendChild(panel);

  wireVersionBadge(panel, VERSION);

  const geoRoot = panel.querySelector<HTMLElement>("#snp-geo-root")!;
  geoRoot.innerHTML = GEO_OVERRIDE_HTML;

  wireGeoOverrideForm(geoRoot, {
    initial: currentOverride,
    onSave: (next) => {
      setGeoOverride(next);
      currentOverride = next;
      hook?.refreshWatches();
      if (next.enabled) {
        sendLocationUpdate(next);
      }
    },
    getNativePosition: nativeGetCurrentPosition,
    initialOpen: false,
    onToggle: () => {},
  });

  const profileBorderRoot = panel.querySelector<HTMLElement>("#snp-profile-border-root")!;
  profileBorderRoot.innerHTML = PROFILE_BORDER_HTML;

  wireProfileBorderForm(profileBorderRoot, {
    initial: currentProfileBorderOpen,
    onSave: (next) => {
      setProfileBorderOpen(next);
      updateProfileBorderOpen(next);
    },
    initialOpen: false,
    onToggle: () => {},
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
