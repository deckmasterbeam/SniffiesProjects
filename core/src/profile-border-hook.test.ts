import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installProfileBorderRedirect } from "./profile-border-hook.js";
import type { ProfileBorderOpen } from "./settings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENABLED_NEW_TAB: ProfileBorderOpen = { enabled: true, openInNewTab: true };
const ENABLED_CURRENT_TAB: ProfileBorderOpen = { enabled: true, openInNewTab: false };
const DISABLED: ProfileBorderOpen = { enabled: false, openInNewTab: true };

const buildContainer = (id: string, withinRadius: "true" | "false"): HTMLElement => {
  const container = document.createElement("div");
  container.setAttribute("data-testid", "markerUserContainer");
  container.dataset.withinRadius = withinRadius;
  container.id = id;
  const child = document.createElement("div");
  container.appendChild(child);
  document.body.appendChild(container);
  return container;
};

const clickOn = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

// Tracks every hook installed in a test so afterEach can uninstall it —
// otherwise listeners leak onto `document` across tests.
let installed: Array<{ uninstall: () => void }>;
const install = (getSettings: () => ProfileBorderOpen) => {
  const hook = installProfileBorderRedirect(getSettings);
  installed.push(hook);
  return hook;
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let openSpy: ReturnType<typeof vi.fn>;
let originalOpen: typeof window.open;
let assignSpy: ReturnType<typeof vi.fn>;
let originalLocation: Location;

beforeEach(() => {
  document.body.innerHTML = "";
  installed = [];
  openSpy = vi.fn();
  originalOpen = window.open;
  window.open = openSpy as unknown as typeof window.open;

  assignSpy = vi.fn();
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    value: { assign: assignSpy },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  for (const hook of installed) {
    hook.uninstall();
  }
  window.open = originalOpen;
  Object.defineProperty(window, "location", {
    value: originalLocation,
    configurable: true,
    writable: true,
  });
  document.body.innerHTML = "";
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("installProfileBorderRedirect", () => {
  it("does nothing when disabled", () => {
    install(() => DISABLED);
    const container = buildContainer("abc123", "false");
    clickOn(container.firstElementChild!);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does nothing when clicking a marker within radius", () => {
    install(() => ENABLED_NEW_TAB);
    const container = buildContainer("abc123", "true");
    clickOn(container.firstElementChild!);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the click target is not within a marker container", () => {
    install(() => ENABLED_NEW_TAB);
    const el = document.createElement("div");
    document.body.appendChild(el);
    clickOn(el);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens the profile in a new tab when enabled and out of radius", () => {
    install(() => ENABLED_NEW_TAB);
    const container = buildContainer("abc123", "false");
    clickOn(container.firstElementChild!);
    expect(openSpy).toHaveBeenCalledWith("https://sniffies.com/profile/abc123", "_blank");
  });

  it("navigates the current tab when openInNewTab is false", () => {
    install(() => ENABLED_CURRENT_TAB);
    const container = buildContainer("abc123", "false");
    clickOn(container.firstElementChild!);
    expect(assignSpy).toHaveBeenCalledWith("https://sniffies.com/profile/abc123");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("prevents the default click behavior when redirecting", () => {
    install(() => ENABLED_NEW_TAB);
    const container = buildContainer("abc123", "false");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    container.firstElementChild!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("stops other capture-phase click listeners on document from firing", () => {
    const before = vi.fn();
    const after = vi.fn();
    document.addEventListener("click", before, true);
    install(() => ENABLED_NEW_TAB);
    document.addEventListener("click", after, true);
    const container = buildContainer("abc123", "false");
    clickOn(container.firstElementChild!);
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).not.toHaveBeenCalled();
    document.removeEventListener("click", before, true);
    document.removeEventListener("click", after, true);
  });

  it("uninstall removes the listener", () => {
    const hook = install(() => ENABLED_NEW_TAB);
    hook.uninstall();
    installed = []; // already uninstalled — don't double-uninstall in afterEach
    const container = buildContainer("abc123", "false");
    clickOn(container.firstElementChild!);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("reads settings freshly on every click", () => {
    let settings = DISABLED;
    install(() => settings);
    const container = buildContainer("abc123", "false");
    clickOn(container.firstElementChild!);
    expect(openSpy).not.toHaveBeenCalled();

    settings = ENABLED_NEW_TAB;
    clickOn(container.firstElementChild!);
    expect(openSpy).toHaveBeenCalledWith("https://sniffies.com/profile/abc123", "_blank");
  });

  it("ignores containers without an id", () => {
    install(() => ENABLED_NEW_TAB);
    const container = buildContainer("", "false");
    clickOn(container.firstElementChild!);
    expect(openSpy).not.toHaveBeenCalled();
  });
});
