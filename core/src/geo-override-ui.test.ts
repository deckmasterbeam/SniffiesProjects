import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GEO_OVERRIDE_HTML from "./geo-override.html";
import { wireGeoOverrideForm } from "./geo-override-ui.js";
import type { GeoOverride } from "./settings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISABLED: GeoOverride = { enabled: false, latitude: 0, longitude: 0 };
const ENABLED: GeoOverride = { enabled: true, latitude: 47.6, longitude: -122.3 };

const el = <T extends HTMLElement>(container: Element, id: string) =>
  container.querySelector<T>(`#${id}`)!;

const click = (el: HTMLElement) => el.dispatchEvent(new Event("click", { bubbles: true }));
const change = (el: HTMLElement) => el.dispatchEvent(new Event("change", { bubbles: true }));
const input = (el: HTMLElement) => el.dispatchEvent(new Event("input", { bubbles: true }));

// ── Setup ─────────────────────────────────────────────────────────────────────

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = GEO_OVERRIDE_HTML;
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("wireGeoOverrideForm", () => {
  describe("initial values", () => {
    it("populates lat and lng when non-zero", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      expect(el<HTMLInputElement>(container, "geo-lat").value).toBe("47.6");
      expect(el<HTMLInputElement>(container, "geo-lng").value).toBe("-122.3");
    });

    it("leaves lat and lng empty when zero", () => {
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      expect(el<HTMLInputElement>(container, "geo-lat").value).toBe("");
      expect(el<HTMLInputElement>(container, "geo-lng").value).toBe("");
    });

    it("checks the enabled checkbox when enabled", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(true);
    });

    it("hides geo-fields when initially disabled", () => {
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      expect(el(container, "geo-fields").style.display).toBe("none");
    });

    it("shows geo-fields when initially enabled", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      expect(el(container, "geo-fields").style.display).toBe("");
    });
  });

  describe("enable toggle", () => {
    it("shows geo-fields when enable is checked", () => {
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = true;
      change(checkbox);
      expect(el(container, "geo-fields").style.display).toBe("");
    });

    it("hides geo-fields when enable is unchecked", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(el(container, "geo-fields").style.display).toBe("none");
    });

    it("does not auto-save when enable is checked", () => {
      const onSave = vi.fn();
      wireGeoOverrideForm(container, { initial: DISABLED, onSave, getNativePosition: vi.fn() });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = true;
      change(checkbox);
      expect(onSave).not.toHaveBeenCalled();
    });

    it("shows 'Getting location…' status when enable is unchecked", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(el(container, "geo-status").textContent).toBe("Getting location…");
    });

    it("fetches real location and auto-saves with enabled: false when unchecked", () => {
      const onSave = vi.fn();
      const getNativePosition = vi.fn((success: PositionCallback) => {
        success({ coords: { latitude: 51.5, longitude: -0.1, accuracy: 20 } } as GeolocationPosition);
      });
      wireGeoOverrideForm(container, { initial: ENABLED, onSave, getNativePosition });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false, latitude: 51.5, longitude: -0.1 }),
      );
    });

    it("populates lat and lng fields with real location when unchecked", () => {
      const getNativePosition = vi.fn((success: PositionCallback) => {
        success({ coords: { latitude: 51.5, longitude: -0.1, accuracy: 20 } } as GeolocationPosition);
      });
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(el<HTMLInputElement>(container, "geo-lat").value).toBe("51.5");
      expect(el<HTMLInputElement>(container, "geo-lng").value).toBe("-0.1");
    });

    it("shows error status if real location fails when unchecked", () => {
      const getNativePosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback | null) => {
        error?.({ code: 1, message: "User denied geolocation" } as GeolocationPositionError);
      });
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(el(container, "geo-status").textContent).toContain("Could not get location");
    });

    it("cancels pending location fetch when re-enabled before response arrives", () => {
      const onSave = vi.fn();
      let capturedSuccess: PositionCallback | null = null;
      const getNativePosition = vi.fn((success: PositionCallback) => {
        capturedSuccess = success; // hold — don't call yet
      });
      wireGeoOverrideForm(container, { initial: ENABLED, onSave, getNativePosition });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");

      // disable → starts pending fetch
      checkbox.checked = false;
      change(checkbox);
      expect(el(container, "geo-status").textContent).toBe("Getting location…");

      // re-enable before response arrives
      checkbox.checked = true;
      change(checkbox);
      expect(el(container, "geo-status").textContent).toBe("");

      // late response fires — should be ignored
      capturedSuccess!({ coords: { latitude: 51.5, longitude: -0.1, accuracy: 10 } } as GeolocationPosition);
      expect(onSave).not.toHaveBeenCalled();
      expect(el<HTMLInputElement>(container, "geo-lat").value).toBe("47.6"); // unchanged
    });

    it("shows 'Saved.' after real location is fetched and saved on uncheck", async () => {
      const getNativePosition = vi.fn((success: PositionCallback) => {
        success({ coords: { latitude: 51.5, longitude: -0.1, accuracy: 20 } } as GeolocationPosition);
      });
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      await Promise.resolve();
      expect(el(container, "geo-status").textContent).toBe("Saved.");
    });
  });

  describe("save button visibility", () => {
    it("hides save button when lat and lng are empty", () => {
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      expect(el(container, "geo-save").style.display).toBe("none");
    });

    it("hides save button on init even when lat and lng are filled (nothing to save)", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      expect(el(container, "geo-save").style.display).toBe("none");
    });

    it("shows save button after typing lat and lng", () => {
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      const latInput = el<HTMLInputElement>(container, "geo-lat");
      const lngInput = el<HTMLInputElement>(container, "geo-lng");
      latInput.value = "47.6";
      input(latInput);
      lngInput.value = "-122.3";
      input(lngInput);
      expect(el(container, "geo-save").style.display).toBe("");
    });

    it("shows save button when lat is changed from saved value", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      const latInput = el<HTMLInputElement>(container, "geo-lat");
      latInput.value = "999";
      input(latInput);
      expect(el(container, "geo-save").style.display).toBe("");
    });

    it("hides save button when lat is cleared", () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      const latInput = el<HTMLInputElement>(container, "geo-lat");
      latInput.value = "";
      input(latInput);
      expect(el(container, "geo-save").style.display).toBe("none");
    });

    it("hides save button after save (form now matches saved state)", async () => {
      const getNativePosition = vi.fn((success: PositionCallback) => {
        success({ coords: { latitude: 51.5, longitude: -0.1, accuracy: 20 } } as GeolocationPosition);
      });
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition });
      const latInput = el<HTMLInputElement>(container, "geo-lat");
      const lngInput = el<HTMLInputElement>(container, "geo-lng");
      latInput.value = "51.5";
      input(latInput);
      lngInput.value = "-0.1";
      input(lngInput);
      expect(el(container, "geo-save").style.display).toBe("");
      click(el(container, "geo-save"));
      await Promise.resolve();
      expect(el(container, "geo-save").style.display).toBe("none");
    });
  });

  describe("save", () => {
    it("calls onSave with form values on click", () => {
      const onSave = vi.fn();
      wireGeoOverrideForm(container, { initial: ENABLED, onSave, getNativePosition: vi.fn() });
      click(el(container, "geo-save"));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true, latitude: 47.6, longitude: -122.3 }),
      );
    });

    it("shows 'Saved.' status after save resolves", async () => {
      wireGeoOverrideForm(container, { initial: ENABLED, onSave: vi.fn(), getNativePosition: vi.fn() });
      click(el(container, "geo-save"));
      await Promise.resolve();
      expect(el(container, "geo-status").textContent).toBe("Saved.");
    });
  });

  describe("fill with current", () => {
    it("calls getNativePosition on click", () => {
      const getNativePosition = vi.fn();
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition });
      click(el(container, "geo-fill-current"));
      expect(getNativePosition).toHaveBeenCalled();
    });

    it("populates lat and lng on success", () => {
      const getNativePosition = vi.fn((success: PositionCallback) => {
        success({ coords: { latitude: 51.5, longitude: -0.1, accuracy: 20 } } as GeolocationPosition);
      });
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition });
      click(el(container, "geo-fill-current"));
      expect(el<HTMLInputElement>(container, "geo-lat").value).toBe("51.5");
      expect(el<HTMLInputElement>(container, "geo-lng").value).toBe("-0.1");
    });

    it("shows error status on failure", () => {
      const getNativePosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback | null) => {
        error?.({ code: 1, message: "User denied geolocation" } as GeolocationPositionError);
      });
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition });
      click(el(container, "geo-fill-current"));
      expect(el(container, "geo-status").textContent).toContain("Could not get location");
    });
  });

  describe("collapsible", () => {
    it("sets details.open from initialOpen", () => {
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition: vi.fn(), initialOpen: true });
      expect(container.querySelector<HTMLDetailsElement>("#geo-details")!.open).toBe(true);
    });

    it("fires onToggle when details is toggled", () => {
      const onToggle = vi.fn();
      wireGeoOverrideForm(container, { initial: DISABLED, onSave: vi.fn(), getNativePosition: vi.fn(), onToggle });
      const details = container.querySelector<HTMLDetailsElement>("#geo-details")!;
      details.dispatchEvent(new Event("toggle"));
      expect(onToggle).toHaveBeenCalledWith(details.open);
    });
  });
});
