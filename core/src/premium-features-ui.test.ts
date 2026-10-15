import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREMIUM_FEATURES_HTML, wirePremiumFeaturesForm } from "./premium-features-ui.js";
import type { PremiumFeaturesFormContract } from "./contracts.js";
import {
  DEFAULT_PREMIUM_FEATURE_FLAGS,
  DEFAULT_PROFILE_BORDER_OPEN,
  type GeoOverride,
} from "./settings.js";

const NO_COORDS: GeoOverride = { enabled: false, latitude: 0, longitude: 0 };
const CAPTURED: GeoOverride = { enabled: true, latitude: 47.6, longitude: -122.3 };
const CAPTURED_LABEL: GeoOverride = { ...CAPTURED, label: "London, England" };

const el = <T extends HTMLElement>(container: Element, id: string) =>
  container.querySelector<T>(`#${id}`)!;
const fire = (target: HTMLElement, type: string) =>
  target.dispatchEvent(new Event(type, { bubbles: true }));

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = PREMIUM_FEATURES_HTML;
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

const wire = (overrides: Partial<PremiumFeaturesFormContract> = {}) =>
  wirePremiumFeaturesForm(container, {
    initialOpen: false,
    onToggle: () => {},
    initialEnabled: true,
    onToggleEnabled: vi.fn(),
    flags: { ...DEFAULT_PREMIUM_FEATURE_FLAGS },
    onFlagChange: vi.fn(),
    hasPlus: null,
    geo: { initial: NO_COORDS, onClear: vi.fn() },
    border: { initial: { ...DEFAULT_PROFILE_BORDER_OPEN }, onSave: vi.fn() },
    ...overrides,
  });

describe("master toggle", () => {
  it("greys out and disables the feature switches when off, keeping the list visible", () => {
    wire({ initialEnabled: true });
    expect(el<HTMLInputElement>(container, "premium-enabled").checked).toBe(true);
    expect(el<HTMLInputElement>(container, "premium-flag-location").disabled).toBe(false);
    wirePremiumFeaturesForm(container, {
      initialOpen: false,
      onToggle: () => {},
      initialEnabled: false,
      onToggleEnabled: vi.fn(),
      flags: { ...DEFAULT_PREMIUM_FEATURE_FLAGS },
      onFlagChange: vi.fn(),
      hasPlus: null,
      border: { initial: { ...DEFAULT_PROFILE_BORDER_OPEN }, onSave: vi.fn() },
    });
    expect(el(container, "premium-config").classList.contains("snp-disabled")).toBe(true);
    expect(el<HTMLInputElement>(container, "premium-flag-location").disabled).toBe(true);
    expect(el(container, "premium-config").style.display).toBe("");
  });

  it("reports changes and disables the feature switches", () => {
    const onToggleEnabled = vi.fn();
    wire({ onToggleEnabled });
    const box = el<HTMLInputElement>(container, "premium-enabled");
    box.checked = false;
    fire(box, "change");
    expect(onToggleEnabled).toHaveBeenCalledWith(false);
    expect(el<HTMLInputElement>(container, "premium-flag-boundary").disabled).toBe(true);
  });
});

describe("feature switches", () => {
  it("shows each saved flag and reports changes", () => {
    const onFlagChange = vi.fn();
    wire({ flags: { location: true, boundary: false, photos: true }, onFlagChange });
    expect(el<HTMLInputElement>(container, "premium-flag-location").checked).toBe(true);
    const boundary = el<HTMLInputElement>(container, "premium-flag-boundary");
    expect(boundary.checked).toBe(false);
    boundary.checked = true;
    fire(boundary, "change");
    expect(onFlagChange).toHaveBeenCalledWith("boundary", true);
  });

  it("expands a feature's description without toggling its switch", () => {
    const onFlagChange = vi.fn();
    wire({ onFlagChange });
    const toggle = container.querySelector<HTMLButtonElement>(
      "#premium-photos .premium-feature-toggle",
    )!;
    const body = container.querySelector<HTMLElement>("#premium-photos .premium-feature-body")!;
    expect(body.hidden).toBe(true);
    toggle.click();
    expect(body.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(onFlagChange).not.toHaveBeenCalled();
  });
});

describe("Plus notice", () => {
  it.each([
    [true, ""],
    [false, "none"],
    [null, "none"],
  ])("hasPlus=%s -> display %j", (hasPlus, display) => {
    wire({ hasPlus });
    expect(el(container, "premium-plus-notice").style.display).toBe(display);
  });
});

describe("location", () => {
  it("hides clear when nothing is saved", () => {
    wire();
    expect(el(container, "geo-clear").style.display).toBe("none");
    expect(el(container, "geo-saved").textContent).toBe("");
  });

  it("shows coords or the place name, and clears on click", () => {
    const onClear = vi.fn();
    const handle = wire({ geo: { initial: CAPTURED, onClear } });
    expect(el(container, "geo-saved").textContent).toBe("Saved: 47.60000, -122.30000");
    handle.setOverride(CAPTURED_LABEL);
    expect(el(container, "geo-saved").textContent).toBe("Saved: London, England");
    fire(el(container, "geo-clear"), "click");
    expect(el(container, "geo-saved").textContent).toBe("");
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ latitude: 0, longitude: 0 }));
  });

  it("hides the location block when geo is unsupported", () => {
    wire({ geo: undefined });
    expect(el(container, "premium-geo").style.display).toBe("none");
  });
});

describe("profiles outside boundary", () => {
  it("shows Save only when the tab choice differs, then saves", async () => {
    const onSave = vi.fn();
    wire({ border: { initial: { enabled: true, openInNewTab: true }, onSave } });
    const select = el<HTMLSelectElement>(container, "profile-border-tab");
    const save = el(container, "profile-border-save");
    expect(select.value).toBe("new-tab");
    expect(save.style.display).toBe("none");
    select.value = "current-tab";
    fire(select, "change");
    expect(save.style.display).toBe("");
    fire(save, "click");
    expect(onSave).toHaveBeenCalledWith({ enabled: true, openInNewTab: false });
    await Promise.resolve();
    await Promise.resolve();
    expect(save.style.display).toBe("none");
  });
});
