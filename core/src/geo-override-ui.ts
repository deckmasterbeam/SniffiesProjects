import GEO_OVERRIDE_HTML from "./geo-override.html";
import GEO_OVERRIDE_CSS from "./geo-override.css";
import type { GeoOverride } from "./settings.js";
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
  });

  // Tracks the in-flight getNativePosition call triggered by disabling. A new
  // object is created each time; marking it aborted prevents stale callbacks
  // from mutating state after the user has re-enabled spoofing.
  let pendingFetch: { aborted: boolean } | null = null;

  const fillWithCurrentPosition = (onSuccess: () => void): void => {
    const token = { aborted: false };
    pendingFetch = token;
    setStatus("Getting location…");
    options.getNativePosition(
      (pos) => {
        if (token.aborted) { return; }
        pendingFetch = null;
        geoLat.value = String(pos.coords.latitude);
        geoLng.value = String(pos.coords.longitude);
        updateSaveVisibility();
        onSuccess();
      },
      (err) => {
        if (token.aborted) { return; }
        pendingFetch = null;
        setStatus(`Could not get location: ${err.message} (code ${err.code})`);
      },
      { timeout: 10000 },
    );
  };

  // Populate initial values
  const { initial } = options;
  let lastSaved: GeoOverride = { ...initial };

  const formMatchesSaved = (): boolean => {
    const form = readForm();
    return (
      form.enabled === lastSaved.enabled &&
      form.latitude === lastSaved.latitude &&
      form.longitude === lastSaved.longitude
    );
  };

  const updateSaveVisibility = (): void => {
    const hasCoords = geoLat.value.trim() !== "" && geoLng.value.trim() !== "";
    saveBtn.style.display = hasCoords && !formMatchesSaved() ? "" : "none";
  };

  const commitSave = (): Promise<void> =>
    Promise.resolve(options.onSave(readForm())).then(() => {
      lastSaved = readForm();
      setStatus("Saved.");
      updateSaveVisibility();
    });
  geoEnabled.checked = initial.enabled;
  geoFields.style.display = initial.enabled ? "" : "none";
  geoLat.value = initial.latitude !== 0 ? String(initial.latitude) : "";
  geoLng.value = initial.longitude !== 0 ? String(initial.longitude) : "";
  updateSaveVisibility();

  geoEnabled.addEventListener("change", () => {
    geoFields.style.display = geoEnabled.checked ? "" : "none";
    updateSaveVisibility();
    if (geoEnabled.checked) {
      if (pendingFetch) {
        pendingFetch.aborted = true;
        pendingFetch = null;
        setStatus("");
      }
    } else {
      fillWithCurrentPosition(() => {
        void commitSave();
      });
    }
  });

  for (const field of [geoLat, geoLng]) {
    field.addEventListener("input", updateSaveVisibility);
  }

  fillCurrent.addEventListener("click", () => {
    fillWithCurrentPosition(() => setStatus(""));
  });

  saveBtn.addEventListener("click", () => {
    void commitSave();
  });
};
