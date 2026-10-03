import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

const loadModule = async () => {
  vi.resetModules();
  await import("./inject.js");
};

const panelDisplay = (): string | undefined =>
  document.querySelector<HTMLElement>("#snp-panel")?.style.display;

// ── Tests ─────────────────────────────────────────────────────────────────────

// One injection shared by every test: the bookmarklet's document click listener
// can't be removed, so re-injecting per test would stack stale listeners.
describe("bookmarklet", () => {
  const open = vi.fn();

  beforeAll(async () => {
    window.alert = vi.fn();
    window.open = open;
    document.body.innerHTML = `
      <div data-testid="iconHolderRightBottom"></div>
      <div data-testid="markerUserContainer" id="abc123" data-within-radius="false"><img /></div>
    `;
    await loadModule();
  });

  // Empty the page while `document` still exists, so mountFab's observer
  // doesn't fire during environment teardown.
  afterAll(async () => {
    document.body.innerHTML = "";
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("docks the button in the map's icon row", () => {
    const fab = document.querySelector("#snp-fab")!;
    expect(fab.parentElement?.dataset.testid).toBe("iconHolderRightBottom");
  });

  it("only offers the profile-border feature", () => {
    const panel = document.querySelector("#snp-panel")!;
    expect(panel.querySelector("#profile-border-enabled")).not.toBeNull();
    expect(panel.querySelector("#snp-geo-root")).toBeNull();
    expect(panel.querySelector("#snp-bot-block-root")).toBeNull();
  });

  it("toggles the panel from the button and closes it from the close button", () => {
    expect(panelDisplay()).toBe("none");
    document.querySelector<HTMLElement>("#snp-fab")!.click();
    expect(panelDisplay()).toBe("flex");
    document.querySelector<HTMLElement>("#snp-close")!.click();
    expect(panelDisplay()).toBe("none");
  });

  it("leaves out-of-boundary profile clicks alone until enabled", () => {
    document.querySelector<HTMLElement>("#abc123 img")!.click();
    expect(open).not.toHaveBeenCalled();
  });

  it("saves the setting and opens out-of-boundary profiles once enabled", () => {
    const checkbox = document.querySelector<HTMLInputElement>("#profile-border-enabled")!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    expect(JSON.parse(localStorage.getItem("sniffies-profile-border")!).enabled).toBe(true);

    document.querySelector<HTMLElement>("#abc123 img")!.click();
    expect(open).toHaveBeenCalledWith("https://sniffies.com/profile/abc123", "_blank");
  });

  it("toggles the existing panel instead of mounting again when re-run", async () => {
    await loadModule();
    expect(document.querySelectorAll("#snp-panel")).toHaveLength(1);
    expect(panelDisplay()).toBe("flex");
  });
});
