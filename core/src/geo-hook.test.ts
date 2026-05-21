import { beforeEach, describe, expect, it, vi } from "vitest";
import { installGeoHook } from "./geo-hook.js";
import type { GeoOverride } from "./settings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const REAL: GeoOverride = { enabled: false, latitude: 51.5, longitude: -0.1, accuracy: 10 };
const SPOOF: GeoOverride = { enabled: true, latitude: 47.6, longitude: -122.3, accuracy: 15 };

const makePosition = (lat: number, lng: number, accuracy = 10): GeolocationPosition =>
  ({
    coords: { latitude: lat, longitude: lng, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: Date.now(),
  }) as GeolocationPosition;

const REAL_POSITION = makePosition(REAL.latitude, REAL.longitude, REAL.accuracy);

type MockGeo = Geolocation & { _fireWatchers: (pos: GeolocationPosition) => void };

const makeMockGeo = (): MockGeo => {
  const watchers = new Map<number, PositionCallback>();
  let nextId = 1;

  return {
    getCurrentPosition: vi.fn((success: PositionCallback) => { success(REAL_POSITION); }),
    watchPosition: vi.fn((success: PositionCallback) => {
      const id = nextId++;
      watchers.set(id, success);
      return id;
    }),
    clearWatch: vi.fn((id: number) => { watchers.delete(id); }),
    _fireWatchers: (pos: GeolocationPosition) => { for (const cb of watchers.values()) cb(pos); },
  } as unknown as MockGeo;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("installGeoHook", () => {
  let mockGeo: MockGeo;

  beforeEach(() => {
    mockGeo = makeMockGeo();
    Object.defineProperty(navigator, "geolocation", { value: mockGeo, configurable: true });
  });

  it("returns null if already patched", () => {
    (navigator.geolocation as { __sniffiesPatched?: boolean }).__sniffiesPatched = true;
    expect(installGeoHook(() => null)).toBeNull();
  });

  it("passes through real coords when override is null", () => {
    installGeoHook(() => null);
    const success = vi.fn();
    navigator.geolocation.getCurrentPosition(success);
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ coords: expect.objectContaining({ latitude: REAL.latitude, longitude: REAL.longitude }) }),
    );
  });

  it("passes through real coords when override has enabled: false", () => {
    installGeoHook(() => ({ ...SPOOF, enabled: false }));
    const success = vi.fn();
    navigator.geolocation.getCurrentPosition(success);
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ coords: expect.objectContaining({ latitude: REAL.latitude, longitude: REAL.longitude }) }),
    );
  });

  it("spoofs coords when override has enabled: true", () => {
    installGeoHook(() => SPOOF);
    const success = vi.fn();
    navigator.geolocation.getCurrentPosition(success);
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ coords: expect.objectContaining({ latitude: SPOOF.latitude, longitude: SPOOF.longitude, accuracy: SPOOF.accuracy }) }),
    );
  });

  it("spoofs watchPosition callbacks when override is enabled", () => {
    installGeoHook(() => SPOOF);
    const success = vi.fn();
    navigator.geolocation.watchPosition(success);
    mockGeo._fireWatchers(REAL_POSITION);
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ coords: expect.objectContaining({ latitude: SPOOF.latitude, longitude: SPOOF.longitude }) }),
    );
  });

  it("refreshWatches re-fires active watchers with current override applied", () => {
    const hook = installGeoHook(() => SPOOF);
    const success = vi.fn();
    navigator.geolocation.watchPosition(success);
    hook!.refreshWatches();
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ coords: expect.objectContaining({ latitude: SPOOF.latitude, longitude: SPOOF.longitude }) }),
    );
  });

  it("refreshWatches is a no-op when there are no active watchers", () => {
    const originalGetCurrentPosition = mockGeo.getCurrentPosition;
    const hook = installGeoHook(() => SPOOF);
    expect(() => hook!.refreshWatches()).not.toThrow();
    expect(originalGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("clearWatch removes watcher so it is not included in refreshWatches", () => {
    const hook = installGeoHook(() => SPOOF);
    const success = vi.fn();
    const id = navigator.geolocation.watchPosition(success);
    navigator.geolocation.clearWatch(id);
    hook!.refreshWatches();
    expect(success).not.toHaveBeenCalled();
  });

  it("fires onPosition callback with real coords before applying override", () => {
    const onPosition = vi.fn();
    installGeoHook(() => SPOOF, onPosition);
    navigator.geolocation.getCurrentPosition(vi.fn());
    expect(onPosition).toHaveBeenCalledWith({ latitude: REAL.latitude, longitude: REAL.longitude, accuracy: REAL.accuracy });
  });
});
