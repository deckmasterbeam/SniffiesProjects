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
} from "@sniffies-projects/core";
import PANEL_CSS from "./panel.css";
import PANEL_HTML from "./panel.html";

// ── Guard ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
  }
}

// Install the geo hook and fetch interceptor immediately (document-start), so
// they're in place before any Sniffies scripts run. Defer DOM/UI work until
// the document is ready.
if (window.__sniffiesInjected) {
  // Already installed — nothing to do.
} else {
  window.__sniffiesInjected = true;
  let hookState: HookState | null = null;
  try {
    hookState = installHooks();
  } catch (err) {
    console.error("[sniffies-tools] hook install failed:", err);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountUI(hookState), { once: true });
  } else {
    mountUI(hookState);
  }
}

// ── Storage — localStorage adapter ───────────────────────────────────────────

const STORAGE_KEY = "sniffies-geo";

const loadGeoOverride = (): GeoOverride => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_GEO_OVERRIDE, ...JSON.parse(raw) } : { ...DEFAULT_GEO_OVERRIDE };
  } catch {
    return { ...DEFAULT_GEO_OVERRIDE };
  }
};

const saveGeoOverride = (override: GeoOverride): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(override));
};

// ── FAB mount ─────────────────────────────────────────────────────────────────

const mountFab = (fab: HTMLButtonElement): void => {
  const navTarget = document.querySelector<HTMLElement>('[title="Sitelinks"]');
  if (navTarget?.parentElement) {
    navTarget.parentElement.insertBefore(fab, navTarget.nextSibling);
  } else {
    document.body.appendChild(fab);
  }
};

// ── Hooks (runs at document-start, before page scripts) ──────────────────────

interface HookState {
  currentOverride: GeoOverride;
  hook: ReturnType<typeof installGeoHook>;
  nativeGetCurrentPosition: Geolocation["getCurrentPosition"];
  sendLocationUpdate: (override: GeoOverride) => void;
}

function installHooks(): HookState {
  let currentOverride: GeoOverride = loadGeoOverride();
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
        const body = JSON.parse((lastLocationRequest.init.body as string) ?? "{}") as Record<string, unknown>;
        body.virtualLocation = spoofed;
        body.physicalLocation = spoofed;
        void nativeFetch(lastLocationRequest.url, { ...lastLocationRequest.init, body: JSON.stringify(body) });
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
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
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

  return { currentOverride, hook, nativeGetCurrentPosition, sendLocationUpdate };
}

// ── UI (runs after DOMContentLoaded) ─────────────────────────────────────────

function mountUI(state: HookState | null): void {
  const hook = state?.hook ?? null;
  const nativeGetCurrentPosition = state?.nativeGetCurrentPosition ??
    (() => { throw new Error("geolocation unavailable"); });
  const sendLocationUpdate = state?.sendLocationUpdate ?? (() => {});
  let currentOverride = state?.currentOverride ?? { ...DEFAULT_GEO_OVERRIDE };

  const shellStyle = document.createElement("style");
  shellStyle.textContent = PANEL_CSS;
  document.head.appendChild(shellStyle);

  const geoStyle = document.createElement("style");
  geoStyle.textContent = GEO_OVERRIDE_CSS;
  document.head.appendChild(geoStyle);

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

  const geoRoot = panel.querySelector<HTMLElement>("#snp-geo-root")!;
  geoRoot.innerHTML = GEO_OVERRIDE_HTML;

  wireGeoOverrideForm(geoRoot, {
    initial: currentOverride,
    onSave: (next) => {
      saveGeoOverride(next);
      currentOverride = next;
      hook?.refreshWatches();
      if (next.enabled) {
        sendLocationUpdate(next);
      }
    },
    getNativePosition: nativeGetCurrentPosition,
  });

  const closeBtn = panel.querySelector<HTMLButtonElement>("#snp-close")!;
  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });
}
