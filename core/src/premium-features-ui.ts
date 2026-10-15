import PREMIUM_FEATURES_HTML from "./premium-features.html";
import RAW_CSS from "./premium-features.css";
import SWITCH_CSS from "./switch.css";
import { hasCapturedCoords, type GeoOverride, type ProfileBorderOpen } from "./settings.js";
import type { PremiumFeaturesFormContract } from "./contracts.js";

const PREMIUM_FEATURES_CSS = SWITCH_CSS + RAW_CSS;

export { PREMIUM_FEATURES_HTML, PREMIUM_FEATURES_CSS };
export type { PremiumFeaturesFormContract };

export interface PremiumFeaturesFormHandle {
  setOverride: (next: GeoOverride) => void;
}

const TAB_LABELS = {
  current: "Current tab",
  currentSaved: "Current tab (saved)",
  new: "New tab",
  newSaved: "New tab (saved)",
} as const;

const describeLocation = (override: GeoOverride): string =>
  override.label ?? `${override.latitude.toFixed(5)}, ${override.longitude.toFixed(5)}`;

export const wirePremiumFeaturesForm = (
  container: Element,
  options: PremiumFeaturesFormContract,
): PremiumFeaturesFormHandle => {
  const el = <T extends HTMLElement>(id: string): T => container.querySelector<T>(`#${id}`) as T;

  const details = el<HTMLDetailsElement>("premium-details");
  details.open = options.initialOpen;
  details.addEventListener("toggle", () => options.onToggle(details.open));

  el("premium-plus-notice").style.display = options.hasPlus === true ? "" : "none";

  const enabled = el<HTMLInputElement>("premium-enabled");
  const config = el("premium-config");
  // Master off: the feature list stays visible but its switches turn gray and can't be changed.
  const syncEnabled = (): void => {
    config.classList.toggle("snp-disabled", !enabled.checked);
    for (const input of config.querySelectorAll<HTMLInputElement>(".premium-feature-head input")) {
      input.disabled = !enabled.checked;
    }
  };
  enabled.checked = options.initialEnabled;
  syncEnabled();
  enabled.addEventListener("change", () => {
    syncEnabled();
    void options.onToggleEnabled(enabled.checked);
  });

  // Per-feature switches and their expanders
  const FLAG_INPUTS = {
    location: "premium-flag-location",
    boundary: "premium-flag-boundary",
    photos: "premium-flag-photos",
  } as const;
  for (const [key, id] of Object.entries(FLAG_INPUTS) as [keyof typeof FLAG_INPUTS, string][]) {
    const input = el<HTMLInputElement>(id);
    input.checked = options.flags[key];
    input.addEventListener("change", () => {
      void options.onFlagChange(key, input.checked);
    });
  }
  for (const toggle of container.querySelectorAll<HTMLButtonElement>(".premium-feature-toggle")) {
    const body = toggle
      .closest(".premium-feature")!
      .querySelector<HTMLElement>(".premium-feature-body")!;
    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggle.setAttribute("aria-expanded", String(!body.hidden));
    });
  }

  // Location
  const geoClear = el<HTMLButtonElement>("geo-clear");
  const geoSaved = el("geo-saved");
  let current: GeoOverride | null = options.geo ? { ...options.geo.initial } : null;

  const renderGeo = (): void => {
    const captured = current !== null && hasCapturedCoords(current);
    geoClear.style.display = captured ? "" : "none";
    geoSaved.textContent = captured ? `Saved: ${describeLocation(current!)}` : "";
  };

  if (!options.geo) {
    el("premium-geo").style.display = "none";
  }
  renderGeo();

  geoClear.addEventListener("click", () => {
    current = { ...current!, latitude: 0, longitude: 0, label: undefined };
    renderGeo();
    void options.geo?.onClear(current);
  });

  // Profiles outside boundary
  const tabSelect = el<HTMLSelectElement>("profile-border-tab");
  const optionCurrent = tabSelect.querySelector<HTMLOptionElement>('option[value="current-tab"]')!;
  const optionNew = tabSelect.querySelector<HTMLOptionElement>('option[value="new-tab"]')!;
  const saveBtn = el<HTMLButtonElement>("profile-border-save");

  const applyLabels = (openInNewTab: boolean): void => {
    optionCurrent.text = openInNewTab ? TAB_LABELS.current : TAB_LABELS.currentSaved;
    optionNew.text = openInNewTab ? TAB_LABELS.newSaved : TAB_LABELS.new;
  };

  let saved: ProfileBorderOpen = { ...options.border.initial };
  tabSelect.value = saved.openInNewTab ? "new-tab" : "current-tab";
  applyLabels(saved.openInNewTab);
  saveBtn.style.display = "none";

  tabSelect.addEventListener("change", () => {
    saveBtn.style.display = (tabSelect.value === "new-tab") !== saved.openInNewTab ? "" : "none";
  });

  saveBtn.addEventListener("click", () => {
    const next = { ...saved, openInNewTab: tabSelect.value === "new-tab" };
    void Promise.resolve(options.border.onSave(next)).then(() => {
      saved = next;
      applyLabels(next.openInNewTab);
      saveBtn.style.display = "none";
    });
  });

  return {
    setOverride: (next) => {
      current = { ...next };
      renderGeo();
    },
  };
};
