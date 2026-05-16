import {
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_NOTIFY,
  PHONE_E164_REGEX,
  SETTINGS_KEYS,
  getLocalSettings,
  setDebug,
  setGeoOverride,
  setNotify,
  type GeoOverride,
  type NotifySettings,
} from "../shared/settings.js";

const debugToggle = document.getElementById("debug-toggle");
const openFavoritesBtn = document.getElementById("open-favorites");
const phoneInput = document.getElementById("notify-phone");
const endpointInput = document.getElementById("notify-endpoint");
const secretInput = document.getElementById("notify-secret");
const saveBtn = document.getElementById("notify-save");
const testBtn = document.getElementById("notify-test");
const notifyStatus = document.getElementById("notify-status");
const notifyDebugFields = document.getElementById("notify-debug-fields");

const geoEnabled = document.getElementById("geo-enabled");
const geoMap = document.getElementById("geo-map");
const geoMapCanvas = document.getElementById("geo-map-canvas");
const geoMapFallback = document.getElementById("geo-map-fallback");
const geoLat = document.getElementById("geo-lat");
const geoLng = document.getElementById("geo-lng");
const geoAccuracy = document.getElementById("geo-accuracy");
const geoFillCurrent = document.getElementById("geo-fill-current");
const geoSave = document.getElementById("geo-save");
const geoStatus = document.getElementById("geo-status");

const STORAGE_KEY_TEST_USED = SETTINGS_KEYS.notifyTestUsed;
const STORAGE_KEY_MAPBOX_TOKEN = "mapboxToken";
const MAP_NEUTRAL_CENTER = { latitude: 39.8283, longitude: -98.5795 };
const MAP_DEFAULT_ZOOM = 11;
const MAP_NEUTRAL_ZOOM = 3;

declare const __MAPBOX_TOKEN__: string;
interface MapboxLngLat {
  lng: number;
  lat: number;
}
interface MapboxMap {
  on: (event: string, handler: (e?: { originalEvent?: Event }) => void) => void;
  getCenter: () => MapboxLngLat;
  flyTo: (opts: { center: [number, number]; zoom?: number }) => void;
  jumpTo: (opts: { center: [number, number]; zoom?: number }) => void;
  resize: () => void;
  remove: () => void;
}
declare const mapboxgl: {
  accessToken: string;
  Map: new (opts: {
    container: string | HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
    attributionControl?: boolean;
    cooperativeGestures?: boolean;
    dragRotate?: boolean;
    pitchWithRotate?: boolean;
    touchPitch?: boolean;
  }) => MapboxMap;
};

let mapInstance: MapboxMap | null = null;
let suppressMoveEvent = false;
let mapState = {
  latitude: MAP_NEUTRAL_CENTER.latitude,
  longitude: MAP_NEUTRAL_CENTER.longitude,
};

const setDebugFieldsVisible = (visible: boolean): void => {
  if (notifyDebugFields instanceof HTMLElement) {
    notifyDebugFields.style.display = visible ? "flex" : "none";
  }
};

const setTestButtonEnabled = (enabled: boolean): void => {
  if (testBtn instanceof HTMLButtonElement) {
    testBtn.disabled = !enabled;
  }
};

const setStatus = (text: string): void => {
  if (notifyStatus) {
    notifyStatus.textContent = text;
  }
};

const setGeoStatus = (text: string): void => {
  if (geoStatus) {
    geoStatus.textContent = text;
  }
};

const normalizeLongitude = (longitude: number): number => {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
};

const clampLatitude = (latitude: number): number => {
  const limit = 85.05112878;
  return Math.max(-limit, Math.min(limit, latitude));
};

const formatLatitude = (latitude: number): string => latitude.toFixed(6);
const formatLongitude = (longitude: number): string => longitude.toFixed(6);

const setGeoEnabledState = (enabled: boolean): void => {
  if (geoEnabled instanceof HTMLInputElement) {
    geoEnabled.checked = enabled;
  }
  if (geoMap instanceof HTMLElement) {
    geoMap.classList.toggle("is-disabled", !enabled);
    geoMap.setAttribute("aria-disabled", enabled ? "false" : "true");
  }
};

const syncGeoInputsFromState = (): void => {
  if (geoLat instanceof HTMLInputElement) {
    geoLat.value = formatLatitude(mapState.latitude);
  }
  if (geoLng instanceof HTMLInputElement) {
    geoLng.value = formatLongitude(mapState.longitude);
  }
};

const recenterMap = (latitude: number, longitude: number, animated = true): void => {
  mapState = { latitude: clampLatitude(latitude), longitude: normalizeLongitude(longitude) };
  syncGeoInputsFromState();
  if (!mapInstance) return;
  suppressMoveEvent = true;
  const center: [number, number] = [mapState.longitude, mapState.latitude];
  if (animated) {
    mapInstance.flyTo({ center });
  } else {
    mapInstance.jumpTo({ center });
  }
};

const getCurrentGeoOverride = (): GeoOverride => {
  const enabled = geoEnabled instanceof HTMLInputElement ? geoEnabled.checked : false;
  const latitude =
    geoLat instanceof HTMLInputElement ? Number.parseFloat(geoLat.value) : mapState.latitude;
  const longitude =
    geoLng instanceof HTMLInputElement ? Number.parseFloat(geoLng.value) : mapState.longitude;
  const accuracy =
    geoAccuracy instanceof HTMLInputElement ? Number.parseFloat(geoAccuracy.value) : NaN;

  return {
    enabled,
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
    accuracy: Number.isFinite(accuracy) ? accuracy : DEFAULT_GEO_OVERRIDE.accuracy,
  };
};

const resolveMapboxToken = async (): Promise<string> => {
  const stored = await chrome.storage.local.get(STORAGE_KEY_MAPBOX_TOKEN);
  const fromStorage = typeof stored[STORAGE_KEY_MAPBOX_TOKEN] === "string" ? stored[STORAGE_KEY_MAPBOX_TOKEN] : "";
  if (fromStorage) return fromStorage;
  try {
    return typeof __MAPBOX_TOKEN__ === "string" ? __MAPBOX_TOKEN__ : "";
  } catch {
    return "";
  }
};

const showMapFallback = (message: string): void => {
  if (geoMapFallback instanceof HTMLElement) {
    geoMapFallback.textContent = message;
    geoMapFallback.hidden = false;
  }
};

const waitForMapbox = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof mapboxgl !== "undefined") return resolve();
    const start = Date.now();
    const timer = setInterval(() => {
      if (typeof mapboxgl !== "undefined") {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > 8000) {
        clearInterval(timer);
        reject(new Error("mapbox-gl failed to load"));
      }
    }, 100);
  });

const initMap = async (initialLat: number, initialLng: number, hasSaved: boolean): Promise<void> => {
  if (!(geoMapCanvas instanceof HTMLElement)) return;

  const token = await resolveMapboxToken();
  if (!token) {
    showMapFallback("Set MAPBOX_TOKEN to enable the map picker.");
    return;
  }

  try {
    await waitForMapbox();
  } catch {
    showMapFallback("Could not load Mapbox GL. Check network or CSP.");
    return;
  }

  try {
    mapboxgl.accessToken = token;
    mapInstance = new mapboxgl.Map({
      container: geoMapCanvas,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [initialLng, initialLat],
      zoom: hasSaved ? MAP_DEFAULT_ZOOM : MAP_NEUTRAL_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    mapInstance.on("moveend", () => {
      if (!mapInstance) return;
      if (suppressMoveEvent) {
        suppressMoveEvent = false;
        return;
      }
      const c = mapInstance.getCenter();
      mapState = { latitude: clampLatitude(c.lat), longitude: normalizeLongitude(c.lng) };
      syncGeoInputsFromState();
      setGeoEnabledState(true);
    });

    mapInstance.on("load", () => {
      mapInstance?.resize();
    });
  } catch (error) {
    console.log("Mapbox init failed", error);
    showMapFallback("Mapbox failed to initialize. Token may be invalid.");
  }
};


const sendNativeGeoOverride = async (override: GeoOverride): Promise<void> => {
  const runtime = ((globalThis as typeof globalThis & {
    browser?: { runtime?: { sendNativeMessage?: (message: unknown) => Promise<unknown> } };
  }).browser?.runtime ?? (chrome.runtime as unknown as { sendNativeMessage?: (message: unknown) => Promise<unknown> }));

  if (typeof runtime?.sendNativeMessage !== "function") return;
  try {
    await runtime.sendNativeMessage({ type: "SET_GEO_OVERRIDE", geoOverride: override });
  } catch (error) {
    console.log("Failed to sync geo override to native app", error);
  }
};

const readNotifyForm = (): NotifySettings => ({
  phone: phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : "",
  endpoint: endpointInput instanceof HTMLInputElement ? endpointInput.value.trim() : "",
  secret: secretInput instanceof HTMLInputElement ? secretInput.value.trim() : "",
});

const init = async (): Promise<void> => {
  const settings = await getLocalSettings();
  const { debug, notify } = settings;

  if (debugToggle instanceof HTMLInputElement) {
    debugToggle.checked = debug;
  }
  setDebugFieldsVisible(debug);

  const merged = { ...DEFAULT_NOTIFY, ...notify };
  if (phoneInput instanceof HTMLInputElement) {
    phoneInput.value = merged.phone;
  }
  if (endpointInput instanceof HTMLInputElement) {
    endpointInput.value = merged.endpoint;
  }
  if (secretInput instanceof HTMLInputElement) {
    secretInput.value = merged.secret;
  }

  const { [STORAGE_KEY_TEST_USED]: testUsed } = await chrome.storage.local.get(STORAGE_KEY_TEST_USED);
  setTestButtonEnabled(!testUsed);

  const geo = { ...DEFAULT_GEO_OVERRIDE, ...settings.geoOverride };
  setGeoEnabledState(geo.enabled);
  if (geoLat instanceof HTMLInputElement) {
    geoLat.value = formatLatitude(geo.latitude);
  }
  if (geoLng instanceof HTMLInputElement) {
    geoLng.value = formatLongitude(geo.longitude);
  }
  if (geoAccuracy instanceof HTMLInputElement) {
    geoAccuracy.value = String(geo.accuracy);
  }

  const hasSavedCoordinates = geo.enabled || geo.latitude !== 0 || geo.longitude !== 0;
  const initialLat = hasSavedCoordinates ? geo.latitude : MAP_NEUTRAL_CENTER.latitude;
  const initialLng = hasSavedCoordinates ? geo.longitude : MAP_NEUTRAL_CENTER.longitude;
  mapState = { latitude: initialLat, longitude: initialLng };
  syncGeoInputsFromState();
  await initMap(initialLat, initialLng, hasSavedCoordinates);
};

if (debugToggle instanceof HTMLInputElement) {
  debugToggle.addEventListener("change", () => {
    void setDebug(debugToggle.checked);
    setDebugFieldsVisible(debugToggle.checked);
  });
}

openFavoritesBtn?.addEventListener("click", () => {
  void chrome.tabs.create({
    url: chrome.runtime.getURL("src/favorites/favorites.html"),
  });
  window.close();
});

saveBtn?.addEventListener("click", async () => {
  const next = readNotifyForm();
  if (next.phone && !PHONE_E164_REGEX.test(next.phone)) {
    setStatus("Phone must be E.164 format, e.g. +15551234567");
    if (phoneInput instanceof HTMLInputElement) {
      phoneInput.classList.add("invalid");
      phoneInput.focus();
    }
    return;
  }
  if (phoneInput instanceof HTMLInputElement) {
    phoneInput.classList.remove("invalid");
  }
  await setNotify(next);
  setStatus("Saved.");
});

if (phoneInput instanceof HTMLInputElement) {
  phoneInput.addEventListener("input", async () => {
    phoneInput.classList.remove("invalid");
    await chrome.storage.local.set({ [STORAGE_KEY_TEST_USED]: false });
    setTestButtonEnabled(true);
  });
}

testBtn?.addEventListener("click", async () => {
  const next = readNotifyForm();
  await setNotify(next);
  await chrome.storage.local.set({ [STORAGE_KEY_TEST_USED]: true });
  setTestButtonEnabled(false);
  setStatus("Sending test...");
  try {
    const response = await chrome.runtime.sendMessage({
      type: "NOTIFY_TEST",
    });
    if (response?.ok) {
      setStatus(`Test sent (sid ${response.sid ?? "?"}).`);
    } else {
      setStatus(`Failed: ${response?.error ?? "unknown"}`);
    }
  } catch (err) {
    setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
  }
});

const syncGeoStateFromInputs = (): void => {
  const latitude = geoLat instanceof HTMLInputElement ? Number.parseFloat(geoLat.value) : NaN;
  const longitude = geoLng instanceof HTMLInputElement ? Number.parseFloat(geoLng.value) : NaN;
  const accuracy = geoAccuracy instanceof HTMLInputElement ? Number.parseFloat(geoAccuracy.value) : NaN;

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    recenterMap(latitude, longitude, false);
  }

  if (Number.isFinite(accuracy) && geoAccuracy instanceof HTMLInputElement) {
    geoAccuracy.value = String(Math.max(0, accuracy));
  }

  setGeoEnabledState(true);
};

geoEnabled?.addEventListener("change", () => {
  setGeoEnabledState(geoEnabled instanceof HTMLInputElement ? geoEnabled.checked : false);
});

geoLat?.addEventListener("input", () => {
  syncGeoStateFromInputs();
});

geoLng?.addEventListener("input", () => {
  syncGeoStateFromInputs();
});

geoAccuracy?.addEventListener("input", () => {
  setGeoEnabledState(true);
});

geoFillCurrent?.addEventListener("click", () => {
  if (geoStatus) geoStatus.textContent = "Getting location...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setGeoEnabledState(true);
      recenterMap(pos.coords.latitude, pos.coords.longitude, true);
      if (geoAccuracy instanceof HTMLInputElement) {
        geoAccuracy.value = String(Math.max(0, pos.coords.accuracy || DEFAULT_GEO_OVERRIDE.accuracy));
      }
      if (geoStatus) geoStatus.textContent = "";
    },
    (error) => {
      console.log("Failed to get current position", error);
      if (geoStatus) geoStatus.textContent = "Could not get location.";
    },
  );
});

geoSave?.addEventListener("click", async () => {
  const override = getCurrentGeoOverride();
  await setGeoOverride(override);
  await sendNativeGeoOverride(override);
  if (geoStatus) geoStatus.textContent = "Saved. Reload sniffies.com to apply.";
});

void init();
