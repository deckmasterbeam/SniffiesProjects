import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const POPUP_HTML = `
  <button id="open-settings"></button>
  <div class="snp-title">
    <h1>Sniffies Plug-ins</h1>
    <span id="snp-version-root"></span>
  </div>
  <details id="favorites-details" class="section collapsible">
    <summary><h2>Favorites</h2></summary>
    <div class="collapsible-body">
      <p id="favorites-hint" class="hint"></p>
      <label class="row">
        <input id="favorites-enabled" type="checkbox" />
        <span id="favorites-enable-label">Enable</span>
      </label>
    </div>
  </details>
  <div id="snp-update-root"></div>
  <div id="snp-premium-root"></div>
  <div id="snp-bot-block-root"></div>
  <div id="snp-profile-filters-root"></div>
`;

const flushPromises = () => new Promise<void>((r) => setTimeout(r, 0));

const getElements = () => ({
  version: document.getElementById("snp-version") as HTMLElement,
  favoritesEnabled: document.getElementById("favorites-enabled") as HTMLInputElement,
  favoritesDetails: document.getElementById("favorites-details") as HTMLDetailsElement,
  botBlockingEnabled: document.getElementById("bot-block-enabled") as HTMLInputElement,
  botBlockingDetails: document.getElementById("bot-block-details") as HTMLDetailsElement,
  botBlockingHint: document.getElementById("bot-block-hint") as HTMLElement,
  botBlockingEnableLabel: document.getElementById("bot-block-enable-label") as HTMLElement,
  botBlockingCount: document.getElementById("bot-block-count") as HTMLElement,
  premiumEnabled: document.getElementById("premium-enabled") as HTMLInputElement,
  premiumConfig: document.getElementById("premium-config") as HTMLElement,
  premiumDetails: document.getElementById("premium-details") as HTMLDetailsElement,
  plusNotice: document.getElementById("premium-plus-notice") as HTMLElement,
  geoClear: document.getElementById("geo-clear") as HTMLButtonElement,
  geoSaved: document.getElementById("geo-saved") as HTMLElement,
  profileBorderTab: document.getElementById("profile-border-tab") as HTMLSelectElement,
  profileBorderSave: document.getElementById("profile-border-save") as HTMLButtonElement,
});

const loadModule = async () => {
  vi.resetModules();
  document.body.innerHTML = POPUP_HTML;
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition: vi.fn() },
    writable: true,
    configurable: true,
  });
  await import("./popup.js");
  await flushPromises();
};

// __REPORTING_ENABLED__ is baked in false at the vitest.config.ts level, so
// the only way to exercise the enabled branch is mocking the env module.
const loadModuleWithReportingEnabled = async () => {
  vi.resetModules();
  vi.doMock("../shared/env.js", async () => {
    const actual = await vi.importActual<typeof import("../shared/env.js")>("../shared/env.js");
    return { ...actual, REPORTING_ENABLED: true };
  });
  document.body.innerHTML = POPUP_HTML;
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition: vi.fn() },
    writable: true,
    configurable: true,
  });
  await import("./popup.js");
  await flushPromises();
};

describe("popup — settings button", () => {
  it("is hidden outside debug builds", async () => {
    await loadModule();
    expect(document.getElementById("open-settings")!.style.display).toBe("none");
  });

  it("is shown in debug builds", async () => {
    vi.resetModules();
    vi.doMock("../shared/env.js", async () => {
      const actual = await vi.importActual<typeof import("../shared/env.js")>("../shared/env.js");
      return { ...actual, DEBUG: true };
    });
    document.body.innerHTML = POPUP_HTML;
    await import("./popup.js");
    await flushPromises();
    vi.doUnmock("../shared/env.js");
    expect(document.getElementById("open-settings")!.style.display).toBe("");
  });
});

describe("popup — version badge", () => {
  beforeEach(loadModule);

  it("renders the extension's manifest version", () => {
    const { version } = getElements();
    expect(version.textContent).toBe("v0.0.0");
  });

  it("renders a different version when the manifest reports one", async () => {
    (chrome.runtime.getManifest as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      version: "2.3.4",
    });
    await loadModule();
    const { version } = getElements();
    expect(version.textContent).toBe("v2.3.4");
  });
});

const loadWithStored = async (stored: Record<string, unknown>) => {
  vi.resetModules();
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(stored);
  document.body.innerHTML = POPUP_HTML;
  await import("./popup.js");
  await flushPromises();
};

describe("popup — premium features master toggle", () => {
  it("is on by default with the configuration visible", async () => {
    await loadModule();
    const { premiumEnabled, premiumConfig } = getElements();
    expect(premiumEnabled.checked).toBe(true);
    expect(premiumConfig.style.display).toBe("");
  });

  it("saves the switch and greys out the feature list when turned off", async () => {
    await loadModule();
    const { premiumEnabled, premiumConfig } = getElements();
    premiumEnabled.checked = false;
    premiumEnabled.dispatchEvent(new Event("change"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ premiumFeaturesEnabled: false });
    expect(premiumConfig.style.display).toBe("");
    expect(premiumConfig.classList.contains("snp-disabled")).toBe(true);
  });

  it("migrates from the old per-feature toggles when no master value is saved", async () => {
    await loadWithStored({ profileBorderOpen: { enabled: false, openInNewTab: true } });
    expect(getElements().premiumEnabled.checked).toBe(false);
    await loadWithStored({ geoOverride: { enabled: true, latitude: 0, longitude: 0 } });
    expect(getElements().premiumEnabled.checked).toBe(true);
  });

  it("a saved master value wins over the old toggles", async () => {
    await loadWithStored({
      premiumFeaturesEnabled: false,
      geoOverride: { enabled: true, latitude: 1, longitude: 1 },
    });
    expect(getElements().premiumEnabled.checked).toBe(false);
  });

  it("shows the Plus notice only when the account is known to have Plus", async () => {
    await loadWithStored({ hasPlus: true });
    expect(getElements().plusNotice.style.display).toBe("");
    await loadWithStored({ hasPlus: false });
    expect(getElements().plusNotice.style.display).toBe("none");
    await loadModule();
    expect(getElements().plusNotice.style.display).toBe("none");
  });

  it("saves the section open state on toggle", async () => {
    await loadModule();
    const { premiumDetails } = getElements();
    premiumDetails.open = true;
    premiumDetails.dispatchEvent(new Event("toggle"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ premiumSectionOpen: true });
  });
});

describe("popup — profiles outside boundary", () => {
  beforeEach(loadModule);

  it("save button is hidden on init and appears when the select differs", () => {
    const { profileBorderTab, profileBorderSave } = getElements();
    expect(profileBorderSave.style.display).toBe("none");
    profileBorderTab.value = "current-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    expect(profileBorderSave.style.display).toBe("");
    profileBorderTab.value = "new-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    expect(profileBorderSave.style.display).toBe("none");
  });

  it("saves openInNewTab and hides the button afterwards", async () => {
    const { profileBorderTab, profileBorderSave } = getElements();
    profileBorderTab.value = "current-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    profileBorderSave.click();
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      profileBorderOpen: expect.objectContaining({ openInNewTab: false }),
    });
    expect(profileBorderSave.style.display).toBe("none");
    expect(profileBorderTab.options[0]?.text).toContain("(saved)");
  });
});

describe("popup — favorites", () => {
  beforeEach(loadModule);

  it("hides the favorites section when FAVORITES_NOTIFICATIONS_ENABLED is false", () => {
    const { favoritesDetails, favoritesEnabled } = getElements();
    expect(favoritesDetails.style.display).toBe("none");
    expect(favoritesEnabled.checked).toBe(false);
  });

  it("saves favoritesEnabled when checkbox is toggled (when enabled)", async () => {
    vi.resetModules();
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      favoritesEnabled: false,
      favoritesSectionOpen: false,
      profileBorderOpen: { enabled: false, openInNewTab: false },
      profileBorderSectionOpen: false,
      geoOverride: { enabled: false, latitude: 0, longitude: 0 },
      geoSectionOpen: false,
      guid: "",
      phone: "",
    });
    document.body.innerHTML = POPUP_HTML;
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: vi.fn() },
      writable: true,
      configurable: true,
    });
    const mod = await import("./popup.js");
    await flushPromises();
    const { favoritesEnabled } = getElements();
    favoritesEnabled.checked = true;
    favoritesEnabled.dispatchEvent(new Event("change"));
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ favoritesEnabled: true });
    return mod;
  });

  it("saves favorites section open state on toggle", () => {
    const { favoritesDetails } = getElements();
    favoritesDetails.open = true;
    favoritesDetails.dispatchEvent(new Event("toggle"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ favoritesSectionOpen: true });
  });
});

describe("popup — bot blocking", () => {
  beforeEach(loadModule);

  it("checkbox is unchecked and disabled on init when REPORTING_ENABLED is false", () => {
    const { botBlockingEnabled } = getElements();
    expect(botBlockingEnabled.checked).toBe(false);
    expect(botBlockingEnabled.disabled).toBe(true);
  });

  it("shows coming soon hint when REPORTING_ENABLED is false", () => {
    const { botBlockingHint } = getElements();
    expect(botBlockingHint.textContent).toBe("Coming soon!");
  });

  it("strikes through enable label when REPORTING_ENABLED is false", () => {
    const { botBlockingEnableLabel } = getElements();
    expect(botBlockingEnableLabel.style.textDecoration).toBe("line-through");
  });

  it("saves bot blocking section open state on toggle", () => {
    const { botBlockingDetails } = getElements();
    botBlockingDetails.open = true;
    botBlockingDetails.dispatchEvent(new Event("toggle"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ botBlockingSectionOpen: true });
  });

  it("hides the blocked count when REPORTING_ENABLED is false", () => {
    const { botBlockingCount } = getElements();
    expect(botBlockingCount.textContent).toBe("");
  });
});

describe("popup — bot blocking count (REPORTING_ENABLED true)", () => {
  // vi.doMock registrations survive vi.resetModules(), so without this the
  // env.js mock would leak into every describe block below this one.
  afterEach(() => {
    vi.doUnmock("../shared/env.js");
  });

  it("shows the distinct count blocked across today and yesterday", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await chrome.storage.local.set({
      blockedBotEventsByDay: { [today]: ["a", "b", "c"] },
    });
    await loadModuleWithReportingEnabled();
    const { botBlockingCount } = getElements();
    expect(botBlockingCount.textContent).toBe("3 bots blocked in the last 24 hours");
  });

  it("uses singular phrasing for a count of 1", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await chrome.storage.local.set({ blockedBotEventsByDay: { [today]: ["a"] } });
    await loadModuleWithReportingEnabled();
    const { botBlockingCount } = getElements();
    expect(botBlockingCount.textContent).toBe("1 bot blocked in the last 24 hours");
  });

  it("is empty when nothing has been blocked", async () => {
    await loadModuleWithReportingEnabled();
    const { botBlockingCount } = getElements();
    expect(botBlockingCount.textContent).toBe("");
  });
});

describe("popup — location", () => {
  it("shows no saved location and hides Clear when nothing has been captured", async () => {
    await loadModule();
    const { geoSaved, geoClear } = getElements();
    expect(geoSaved.textContent).toBe("");
    expect(geoClear.style.display).toBe("none");
  });

  it("shows the saved coords, and Clear wipes them", async () => {
    await loadWithStored({
      geoOverride: { enabled: true, latitude: 40.7128, longitude: -74.006 },
    });
    const { geoSaved, geoClear } = getElements();
    expect(geoSaved.textContent).toBe("Saved: 40.71280, -74.00600");
    geoClear.click();
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      geoOverride: { enabled: true, latitude: 0, longitude: 0, label: undefined },
    });
  });
});

describe("popup — profile filters", () => {
  beforeEach(loadModule);

  it("is off by default and saves the switch when toggled", () => {
    const enabled = document.getElementById("profile-filters-enabled") as HTMLInputElement;
    expect(enabled.checked).toBe(false);
    enabled.checked = true;
    enabled.dispatchEvent(new Event("change"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ profileFiltersEnabled: true });
  });

  it("saves the section open state on toggle", () => {
    const details = document.getElementById("profile-filters-details") as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ profileFiltersSectionOpen: true });
  });
});
