import GEO_OVERRIDE_HTML from "./geo-override.html";
import GEO_OVERRIDE_CSS from "./geo-override.css";
import { randomAccuracy, type GeoOverride } from "./settings.js";
import type { GeoOverrideFormContract } from "./geo-override-form-contract.js";

export { GEO_OVERRIDE_HTML, GEO_OVERRIDE_CSS };
export type { GeoOverrideFormContract };

export const wireGeoOverrideForm = (container: Element, options: GeoOverrideFormContract): void => {
  const el = <T extends Element>(id: string): T => container.querySelector<T>(`#${id}`) as T;

  const details = container.querySelector<HTMLDetailsElement>("#geo-details");
  const geoEnabled = el<HTMLInputElement>("geo-enabled");
  const geoFields = el<HTMLElement>("geo-fields");
  const geoLat = el<HTMLInputElement>("geo-lat");
  const geoLng = el<HTMLInputElement>("geo-lng");
  const geoAccuracy = el<HTMLInputElement>("geo-accuracy");
  const fillCurrent = el<HTMLButtonElement>("geo-fill-current");
  const saveBtn = el<HTMLButtonElement>("geo-save");
  const statusEl = el<HTMLElement>("geo-status");

  // Wire collapsible
  if (details) {
    if (options.initialOpen !== undefined) {
      details.open = options.initialOpen;
    }
    if (options.onToggle) {
      const onToggle = options.onToggle;
      details.addEventListener("toggle", () => onToggle(details.open));
    }
  }

  const setStatus = (text: string): void => {
    statusEl.textContent = text;
  };

  const readForm = (): GeoOverride => ({
    enabled: geoEnabled.checked,
    latitude: parseFloat(geoLat.value) || 0,
    longitude: parseFloat(geoLng.value) || 0,
    accuracy: parseFloat(geoAccuracy.value) || 10,
  });

  const reRandomizeAccuracy = (): void => {
    geoAccuracy.value = String(randomAccuracy());
  };

  const updateSaveVisibility = (): void => {
    saveBtn.style.display = geoLat.value.trim() !== "" && geoLng.value.trim() !== "" ? "" : "none";
  };

  // Populate initial values
  const { initial } = options;
  geoEnabled.checked = initial.enabled;
  geoFields.style.display = initial.enabled ? "" : "none";
  geoLat.value = initial.latitude !== 0 ? String(initial.latitude) : "";
  geoLng.value = initial.longitude !== 0 ? String(initial.longitude) : "";
  geoAccuracy.value = String(initial.accuracy);
  updateSaveVisibility();

  geoEnabled.addEventListener("change", () => {
    geoFields.style.display = geoEnabled.checked ? "" : "none";
    reRandomizeAccuracy();
    if (!geoEnabled.checked) {
      setStatus("Getting location…");
      options.getNativePosition(
        (pos) => {
          geoLat.value = String(pos.coords.latitude);
          geoLng.value = String(pos.coords.longitude);
          reRandomizeAccuracy();
          updateSaveVisibility();
          void Promise.resolve(options.onSave(readForm())).then(() => {
            setStatus("Saved.");
          });
        },
        (err) => setStatus(`Could not get location: ${err.message} (code ${err.code})`),
        { timeout: 10000 },
      );
    }
  });

  for (const field of [geoLat, geoLng]) {
    field.addEventListener("blur", reRandomizeAccuracy);
    field.addEventListener("input", updateSaveVisibility);
  }

  fillCurrent.addEventListener("click", () => {
    setStatus("Getting location…");
    options.getNativePosition(
      (pos) => {
        geoLat.value = String(pos.coords.latitude);
        geoLng.value = String(pos.coords.longitude);
        reRandomizeAccuracy();
        updateSaveVisibility();
        setStatus("");
      },
      (err) => setStatus(`Could not get location: ${err.message} (code ${err.code})`),
      { timeout: 10000 },
    );
  });

  saveBtn.addEventListener("click", () => {
    void Promise.resolve(options.onSave(readForm())).then(() => {
      setStatus("Saved.");
    });
  });
};
