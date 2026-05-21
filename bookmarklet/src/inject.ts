// Sniffies bookmarklet injection script
// Bookmarklet loader:
//   javascript:(function(){var s=document.createElement('script');s.src='https://YOUR_VERCEL_URL/inject.js?t='+Date.now();document.head.appendChild(s);})();

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
import { mountFab, isSniffiesDomain } from "./mount-fab.js";

// ── Guard ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
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

if (window.__sniffiesInjected) {
  const panel = document.getElementById("snp-panel");
  if (panel) {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  }
} else {
  window.__sniffiesInjected = true;
  main();
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  if (!isSniffiesDomain()) {
    return;
  }
  alert("Sniffies Tools loaded! Tap the 📍 button in the nav bar to open the location panel.");

  let currentOverride: GeoOverride = loadGeoOverride();
  console.log("[sniffies-geo] initial override", currentOverride);
  const hook = installGeoHook(() => currentOverride);
  console.log("[sniffies-geo] hook installed", hook ? "yes" : "already patched");
  const nativeGetCurrentPosition =
    hook?.nativeGetCurrentPosition ??
    navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);

  // Intercept fetch so pre-existing watchPosition watchers (registered before this
  // bookmarklet loaded) also send spoofed coords to the Sniffies location API.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (currentOverride.enabled && url.includes("/api/visitor/current/location")) {
      try {
        const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
        const spoofed = { lat: currentOverride.latitude, lng: currentOverride.longitude };
        body.virtualLocation = spoofed;
        body.physicalLocation = spoofed;
        console.log("[sniffies-geo] intercepting location request", spoofed);
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        // leave the request unmodified if parsing fails
      }
    }
    return nativeFetch(input, init);
  };

  // Inject shell styles (FAB + panel chrome)
  const shellStyle = document.createElement("style");
  shellStyle.textContent = PANEL_CSS;
  document.head.appendChild(shellStyle);

  // Inject geo form styles from core
  const geoStyle = document.createElement("style");
  geoStyle.textContent = GEO_OVERRIDE_CSS;
  document.head.appendChild(geoStyle);

  // Inject trigger button into the Sniffies nav bar
  const fab = document.createElement("button");
  fab.id = "snp-fab";
  fab.title = "Sniffies Tools";
  fab.textContent = "📍"; // TODO: change out with my icon, could stand to make it even more custom
  mountFab(fab);

  // Inject panel shell
  const panel = document.createElement("div");
  panel.id = "snp-panel";
  panel.style.display = "none";
  panel.innerHTML = PANEL_HTML;
  document.body.appendChild(panel);

  // Inject geo form from core into placeholder
  const geoRoot = panel.querySelector<HTMLElement>("#snp-geo-root")!;
  geoRoot.innerHTML = GEO_OVERRIDE_HTML;

  wireGeoOverrideForm(geoRoot, {
    initial: currentOverride,
    onSave: (next) => {
      console.log("[sniffies-geo] override saved", next);
      saveGeoOverride(next);
      currentOverride = next;
      hook?.refreshWatches();
    },
    getNativePosition: nativeGetCurrentPosition,
  });

  // Shell interaction
  const closeBtn = panel.querySelector<HTMLButtonElement>("#snp-close")!;
  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });
}
