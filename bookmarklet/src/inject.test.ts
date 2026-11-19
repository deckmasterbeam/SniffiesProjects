import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

const loadModule = async () => {
  vi.resetModules();
  await import("./inject.js");
};

const panelDisplay = (): string | undefined =>
  document.querySelector<HTMLElement>("#snp-panel")?.style.display;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("bookmarklet", () => {
  const open = vi.fn();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });

  beforeAll(async () => {
    window.alert = vi.fn();
    window.open = open;
    vi.stubGlobal("fetch", fetchMock);
    // jsdom's WebSocket would try to connect; the hook only needs a constructor to wrap.
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
    }
    vi.stubGlobal("WebSocket", FakeWebSocket);
    document.body.innerHTML = `
      <div data-testid="iconHolderRightBottom"></div>
      <div data-testid="markerUserContainer" id="abc123" data-within-radius="false"><img /></div>
    `;
    await loadModule();
  });

  afterAll(async () => {
    delete (Object.prototype as Record<string, unknown>).maxSelections;
    delete (Object.prototype as Record<string, unknown>)["sexuality.attitude"];
    document.body.innerHTML = "";
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const initPings = (): unknown[] =>
    fetchMock.mock.calls
      .filter(([url]) => url === "https://server.example/api/logInit")
      .map(([, init]) => JSON.parse(init.body));

  it("sends no init ping on load, before any user id is known", () => {
    expect(initPings()).toEqual([]);
  });

  it("sends one init ping with the user id once the map draws the account's marker", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-testid="cv-marker-container" id="me123"></div>',
    );
    await vi.waitFor(() =>
      expect(initPings()).toEqual([
        { userId: "me123", clientType: "bookmarklet", version: "0.0.0-test" },
      ]),
    );
  });

  it("docks the button in the map's icon row", () => {
    const fab = document.querySelector("#snp-fab")!;
    expect(fab.parentElement?.dataset.testid).toBe("iconHolderRightBottom");
  });

  it("only offers the profile-border feature", () => {
    const panel = document.querySelector("#snp-panel")!;
    expect(panel.querySelector("#premium-enabled")).not.toBeNull();
    expect(panel.querySelector("#profile-border-tab")).not.toBeNull();
    expect(panel.querySelector("#premium-geo")!.getAttribute("style")).toContain("none");
    expect(panel.querySelector("#premium-plus-notice")!.getAttribute("style")).toContain("none");
    expect(panel.querySelector("#snp-bot-block-root")).toBeNull();
  });

  it("toggles the panel from the button and closes it from the close button", () => {
    expect(panelDisplay()).toBe("none");
    document.querySelector<HTMLElement>("#snp-fab")!.click();
    expect(panelDisplay()).toBe("flex");
    document.querySelector<HTMLElement>("#snp-close")!.click();
    expect(panelDisplay()).toBe("none");
  });

  it("opens out-of-boundary profiles by default (premium features default on)", () => {
    document.querySelector<HTMLElement>("#abc123 img")!.click();
    expect(open).toHaveBeenCalledWith("https://sniffies.com/profile/abc123", "_blank");
  });

  it("saves the master switch and leaves clicks alone once it is turned off", () => {
    open.mockClear();
    const checkbox = document.querySelector<HTMLInputElement>("#premium-enabled")!;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    expect(localStorage.getItem("sniffies-premium-features-enabled")).toBe("false");

    document.querySelector<HTMLElement>("#abc123 img")!.click();
    expect(open).not.toHaveBeenCalled();
  });

  it("lifts the selection cap on Sniffies' own stat filters once Profile Filters is enabled", () => {
    const option = { name: "PROFILE.STATS.STATS.BODY_TYPE", key: "stats.body" };
    const cap = (): number | undefined => (option as { maxSelections?: number }).maxSelections;
    expect(cap()).toBeUndefined();

    const checkbox = document.querySelector<HTMLInputElement>("#profile-filters-enabled")!;
    expect(checkbox.checked).toBe(false);
    expect(document.querySelector("#profile-filters-hint")!.textContent).toContain("Position");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    expect(localStorage.getItem("sniffies-profile-filters-enabled")).toBe("true");
    expect(cap()).toBe(99);

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    expect(cap()).toBeUndefined();
  });

  it("toggles the existing panel instead of mounting again when re-run", async () => {
    await loadModule();
    expect(document.querySelectorAll("#snp-panel")).toHaveLength(1);
    expect(panelDisplay()).toBe("flex");
  });
});
