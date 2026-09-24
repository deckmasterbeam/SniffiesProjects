import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GEO_OVERRIDE_HTML from "./geo-override.html";
import { wireGeoOverrideForm } from "./geo-override-ui.js";
import type { GeoOverride } from "./settings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NO_COORDS: GeoOverride = { enabled: false, latitude: 0, longitude: 0 };
const ARMED_NO_COORDS: GeoOverride = { enabled: true, latitude: 0, longitude: 0 };
const CAPTURED_OFF: GeoOverride = { enabled: false, latitude: 47.6, longitude: -122.3 };
const CAPTURED_ON: GeoOverride = { enabled: true, latitude: 47.6, longitude: -122.3 };
const CAPTURED_VIA_SEARCH_ON: GeoOverride = {
  enabled: true,
  latitude: 51.489334,
  longitude: -0.144055,
  label: "London, England",
};
const CAPTURED_VIA_SEARCH_OFF: GeoOverride = { ...CAPTURED_VIA_SEARCH_ON, enabled: false };

const el = <T extends HTMLElement>(container: Element, id: string) =>
  container.querySelector<T>(`#${id}`)!;

const change = (el: HTMLElement) => el.dispatchEvent(new Event("change", { bubbles: true }));
const click = (el: HTMLElement) => el.dispatchEvent(new Event("click", { bubbles: true }));

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
  describe("initial render", () => {
    it("leaves the checkbox enabled and unchecked with a no-coords hint when nothing captured", () => {
      wireGeoOverrideForm(container, { initial: NO_COORDS, onSave: vi.fn(), onClear: vi.fn(), initialOpen: false, onToggle: () => {} });
      expect(el<HTMLInputElement>(container, "geo-enabled").disabled).toBe(false);
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(false);
      expect(el(container, "geo-status").textContent).toBe("No location captured yet.");
    });

    it("checks the box and shows a waiting-for-pick hint when armed but no coords yet", () => {
      wireGeoOverrideForm(container, {
        initial: ARMED_NO_COORDS,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(true);
      expect(el(container, "geo-status").textContent).toBe(
        "Enabled — go pick a location with Sniffies' Travel Mode.",
      );
    });

    it("checks the box and shows the spoofed coords when enabled with captured coords", () => {
      wireGeoOverrideForm(container, {
        initial: CAPTURED_ON,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(true);
      expect(el(container, "geo-status").textContent).toBe("Spoofing: 47.60000, -122.30000");
    });

    it("leaves the box unchecked and shows the last coords when captured but disabled", () => {
      wireGeoOverrideForm(container, {
        initial: CAPTURED_OFF,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(false);
      expect(el(container, "geo-status").textContent).toBe("Off — last set to 47.60000, -122.30000");
    });

    it("hides the clear button when nothing has been captured", () => {
      wireGeoOverrideForm(container, { initial: NO_COORDS, onSave: vi.fn(), onClear: vi.fn(), initialOpen: false, onToggle: () => {} });
      expect(el(container, "geo-clear").style.display).toBe("none");
    });

    it("shows the clear button once coords are captured, whether enabled or not", () => {
      wireGeoOverrideForm(container, {
        initial: CAPTURED_OFF,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el(container, "geo-clear").style.display).toBe("");
    });
  });

  describe("city-search captured location (label)", () => {
    it("shows the confirmation phrasing with the place name when enabled", () => {
      wireGeoOverrideForm(container, {
        initial: CAPTURED_VIA_SEARCH_ON,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el(container, "geo-status").textContent).toBe(
        "Captured your desired location change to: London, England",
      );
    });

    it("shows the place name (not raw coords) when disabled", () => {
      wireGeoOverrideForm(container, {
        initial: CAPTURED_VIA_SEARCH_OFF,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      expect(el(container, "geo-status").textContent).toBe("Off — last set to London, England");
    });

    it("shows raw coords (not the confirmation phrasing) once a label-less capture replaces it", () => {
      const handle = wireGeoOverrideForm(container, {
        initial: CAPTURED_VIA_SEARCH_ON,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      handle.setOverride(CAPTURED_ON);
      expect(el(container, "geo-status").textContent).toBe("Spoofing: 47.60000, -122.30000");
    });
  });

  describe("toggling", () => {
    it("can be checked with no coords captured yet — not disabled", () => {
      const onSave = vi.fn();
      wireGeoOverrideForm(container, { initial: NO_COORDS, onSave, onClear: vi.fn(), initialOpen: false, onToggle: () => {} });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = true;
      change(checkbox);
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    });

    it("calls onSave with enabled: true when checked (coords preserved)", () => {
      const onSave = vi.fn();
      wireGeoOverrideForm(container, {
        initial: CAPTURED_OFF,
        onSave,
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = true;
      change(checkbox);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true, latitude: 47.6, longitude: -122.3 }),
      );
    });

    it("calls onSave with enabled: false when unchecked", () => {
      const onSave = vi.fn();
      wireGeoOverrideForm(container, {
        initial: CAPTURED_ON,
        onSave,
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    });

    it("updates the status text immediately after toggling", () => {
      wireGeoOverrideForm(container, {
        initial: NO_COORDS,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = true;
      change(checkbox);
      expect(el(container, "geo-status").textContent).toBe(
        "Enabled — go pick a location with Sniffies' Travel Mode.",
      );
    });
  });

  describe("clear button", () => {
    it("calls onClear with the cleared override (coords/label gone, enabled preserved)", () => {
      const onClear = vi.fn();
      wireGeoOverrideForm(container, {
        initial: CAPTURED_ON,
        onSave: vi.fn(),
        onClear,
        initialOpen: false,
        onToggle: () => {},
      });
      click(el(container, "geo-clear"));
      expect(onClear).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true, latitude: 0, longitude: 0, label: undefined }),
      );
    });

    it("does not uncheck the checkbox — clearing the location doesn't turn spoofing off", () => {
      wireGeoOverrideForm(container, {
        initial: CAPTURED_ON,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      click(el(container, "geo-clear"));
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(true);
      expect(el(container, "geo-status").textContent).toBe(
        "Enabled — go pick a location with Sniffies' Travel Mode.",
      );
      expect(el(container, "geo-clear").style.display).toBe("none");
    });

    it("stays unchecked if it was already disabled before clearing", () => {
      wireGeoOverrideForm(container, {
        initial: CAPTURED_OFF,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      click(el(container, "geo-clear"));
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(false);
      expect(el(container, "geo-status").textContent).toBe("No location captured yet.");
    });
  });

  describe("setOverride handle", () => {
    it("reflects a newly captured location pushed in after mount", () => {
      const handle = wireGeoOverrideForm(container, {
        initial: ARMED_NO_COORDS,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      handle.setOverride(CAPTURED_ON);
      expect(el<HTMLInputElement>(container, "geo-enabled").checked).toBe(true);
      expect(el(container, "geo-status").textContent).toBe("Spoofing: 47.60000, -122.30000");
      expect(el(container, "geo-clear").style.display).toBe("");
    });

    it("a subsequent toggle after setOverride saves from the pushed-in state", () => {
      const onSave = vi.fn();
      const handle = wireGeoOverrideForm(container, {
        initial: NO_COORDS,
        onSave,
        onClear: vi.fn(),
        initialOpen: false,
        onToggle: () => {},
      });
      handle.setOverride(CAPTURED_ON);
      const checkbox = el<HTMLInputElement>(container, "geo-enabled");
      checkbox.checked = false;
      change(checkbox);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false, latitude: 47.6, longitude: -122.3 }),
      );
    });
  });

  describe("collapsible", () => {
    it("sets details.open from initialOpen", () => {
      wireGeoOverrideForm(container, {
        initial: NO_COORDS,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: true,
        onToggle: () => {},
      });
      expect(container.querySelector<HTMLDetailsElement>("#geo-details")!.open).toBe(true);
    });

    it("fires onToggle when details is toggled", () => {
      const onToggle = vi.fn();
      wireGeoOverrideForm(container, {
        initial: NO_COORDS,
        onSave: vi.fn(),
        onClear: vi.fn(),
        initialOpen: false,
        onToggle,
      });
      const details = container.querySelector<HTMLDetailsElement>("#geo-details")!;
      details.dispatchEvent(new Event("toggle"));
      expect(onToggle).toHaveBeenCalledWith(details.open);
    });
  });
});
