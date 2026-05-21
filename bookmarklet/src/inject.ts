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

// ── Guard ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __sniffiesInjected?: boolean;
  }
}

if (window.__sniffiesInjected) {
  const panel = document.getElementById("snp-panel");
  if (panel) {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  }
} else {
  window.__sniffiesInjected = true;
  main();
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

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  if (!location.hostname.endsWith("sniffies.com")) {
    return;
  }

  let currentOverride: GeoOverride = loadGeoOverride();
  const hook = installGeoHook(() => currentOverride);
  const nativeGetCurrentPosition =
    hook?.nativeGetCurrentPosition ??
    navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);

  // Inject shell styles (FAB + panel chrome)
  const shellStyle = document.createElement("style");
  shellStyle.textContent = PANEL_CSS;
  document.head.appendChild(shellStyle);

  // Inject geo form styles from core
  const geoStyle = document.createElement("style");
  geoStyle.textContent = GEO_OVERRIDE_CSS;
  document.head.appendChild(geoStyle);

  // Inject FAB trigger
  const fab = document.createElement("button");
  fab.id = "snp-fab";
  fab.title = "Sniffies location override";
  fab.textContent = "📍";
  document.body.appendChild(fab);

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
