import GEO_OVERRIDE_HTML from "./geo-override.html";
import GEO_OVERRIDE_CSS from "./geo-override.css";
import { hasCapturedCoords, type GeoOverride } from "./settings.js";
import type { GeoOverrideFormContract } from "./geo-override-form-contract.js";

export { GEO_OVERRIDE_HTML, GEO_OVERRIDE_CSS };
export type { GeoOverrideFormContract };

export interface GeoOverrideFormHandle {
  /** Pushes a freshly captured (or otherwise externally updated) override into the form. */
  setOverride: (next: GeoOverride) => void;
}

const formatCoords = (override: GeoOverride): string =>
  `${override.latitude.toFixed(5)}, ${override.longitude.toFixed(5)}`;

const describeLocation = (override: GeoOverride): string => override.label ?? formatCoords(override);

export const wireGeoOverrideForm = (
  container: Element,
  options: GeoOverrideFormContract,
): GeoOverrideFormHandle => {
  const el = <T extends Element>(id: string): T => container.querySelector<T>(`#${id}`) as T;

  const details = container.querySelector<HTMLDetailsElement>("#geo-details");
  const geoEnabled = el<HTMLInputElement>("geo-enabled");
  const geoClear = el<HTMLButtonElement>("geo-clear");
  const statusEl = el<HTMLElement>("geo-status");

  if (details) {
    details.open = options.initialOpen;
    details.addEventListener("toggle", () => options.onToggle(details.open));
  }

  let current: GeoOverride = { ...options.initial };

  const render = (): void => {
    geoEnabled.checked = current.enabled;
    geoClear.style.display = hasCapturedCoords(current) ? "" : "none";
    statusEl.textContent = !hasCapturedCoords(current)
      ? current.enabled
        ? "Enabled — go pick a location with Sniffies' Travel Mode."
        : "No location captured yet."
      : current.enabled
        ? current.label
          ? `Captured your desired location change to: ${current.label}`
          : `Spoofing: ${formatCoords(current)}`
        : `Off — last set to ${describeLocation(current)}`;
  };

  render();

  geoEnabled.addEventListener("change", () => {
    current = { ...current, enabled: geoEnabled.checked };
    render();
    void options.onSave(current);
  });

  geoClear.addEventListener("click", () => {
    // enabled is preserved — clearing the location doesn't turn spoofing
    // off, it stays armed waiting for a new pick.
    current = { ...current, latitude: 0, longitude: 0, label: undefined };
    render();
    void options.onClear(current);
  });

  return {
    setOverride: (next) => {
      current = { ...next };
      render();
    },
  };
};
