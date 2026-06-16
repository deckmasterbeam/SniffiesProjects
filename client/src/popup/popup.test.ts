import { beforeEach, describe, expect, it, vi } from "vitest";

const POPUP_HTML = `
  <button id="open-settings"></button>
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
  <div id="snp-geo-root"></div>
  <details id="profile-border-details" class="section collapsible">
    <summary><h2>Open Profiles Outside Boundary</h2></summary>
    <input id="profile-border-enabled" type="checkbox" />
    <label id="profile-border-tab-field" class="field">
      <select id="profile-border-tab">
        <option value="current-tab">Current tab</option>
        <option value="new-tab">New tab</option>
      </select>
    </label>
    <button id="profile-border-save"></button>
  </details>
`;

const flushPromises = () => new Promise<void>((r) => setTimeout(r, 0));

const getElements = () => ({
  favoritesEnabled: document.getElementById("favorites-enabled") as HTMLInputElement,
  favoritesDetails: document.getElementById("favorites-details") as HTMLDetailsElement,
  favoritesHint: document.getElementById("favorites-hint") as HTMLElement,
  favoritesEnableLabel: document.getElementById("favorites-enable-label") as HTMLElement,
  geoFields: document.getElementById("geo-fields") as HTMLElement,
  geoEnabled: document.getElementById("geo-enabled") as HTMLInputElement,
  geoLat: document.getElementById("geo-lat") as HTMLInputElement,
  geoLng: document.getElementById("geo-lng") as HTMLInputElement,
  geoFillCurrent: document.getElementById("geo-fill-current") as HTMLButtonElement,
  geoSave: document.getElementById("geo-save") as HTMLButtonElement,
  geoStatus: document.getElementById("geo-status") as HTMLElement,
  geoDetails: document.getElementById("geo-details") as HTMLDetailsElement,
  profileBorderEnabled: document.getElementById("profile-border-enabled") as HTMLInputElement,
  profileBorderTabField: document.getElementById("profile-border-tab-field") as HTMLElement,
  profileBorderTab: document.getElementById("profile-border-tab") as HTMLSelectElement,
  profileBorderSave: document.getElementById("profile-border-save") as HTMLButtonElement,
  profileBorderDetails: document.getElementById("profile-border-details") as HTMLDetailsElement,
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

describe("popup — profile border open", () => {
  beforeEach(loadModule);

  it("hides the tab field on init when disabled", () => {
    const { profileBorderTabField } = getElements();
    expect(profileBorderTabField.style.display).toBe("none");
  });

  it("shows the tab field when enable is checked", () => {
    const { profileBorderEnabled, profileBorderTabField } = getElements();
    profileBorderEnabled.checked = true;
    profileBorderEnabled.dispatchEvent(new Event("change"));
    expect(profileBorderTabField.style.display).not.toBe("none");
  });

  it("hides the tab field when enable is unchecked after being checked", () => {
    const { profileBorderEnabled, profileBorderTabField } = getElements();
    profileBorderEnabled.checked = true;
    profileBorderEnabled.dispatchEvent(new Event("change"));
    profileBorderEnabled.checked = false;
    profileBorderEnabled.dispatchEvent(new Event("change"));
    expect(profileBorderTabField.style.display).toBe("none");
  });

  it("save button is hidden on init", () => {
    const { profileBorderSave } = getElements();
    expect(profileBorderSave.style.display).toBe("none");
  });

  it("save button appears when select is changed to opposite value", () => {
    const { profileBorderTab, profileBorderSave } = getElements();
    profileBorderTab.value = "current-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    expect(profileBorderSave.style.display).toBe("");
  });

  it("save button hides when select is changed back to saved value", () => {
    const { profileBorderTab, profileBorderSave } = getElements();
    profileBorderTab.value = "current-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    profileBorderTab.value = "new-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    expect(profileBorderSave.style.display).toBe("none");
  });

  it("saves enabled=true and openInNewTab=true when saved with new-tab", async () => {
    const { profileBorderEnabled, profileBorderTab, profileBorderSave } = getElements();
    profileBorderEnabled.checked = true;
    profileBorderTab.value = "new-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    profileBorderSave.click();
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      profileBorderOpen: { enabled: true, openInNewTab: true },
    });
  });

  it("save button hides after saving", async () => {
    const { profileBorderTab, profileBorderSave } = getElements();
    profileBorderTab.value = "new-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    profileBorderSave.click();
    await flushPromises();
    expect(profileBorderSave.style.display).toBe("none");
  });

  it("marks the new-tab option as saved when openInNewTab is true", async () => {
    const { profileBorderTab, profileBorderSave } = getElements();
    profileBorderTab.value = "new-tab";
    profileBorderTab.dispatchEvent(new Event("change"));
    profileBorderSave.click();
    await flushPromises();
    expect(profileBorderTab.options[0]?.text).not.toContain("(saved)");
    expect(profileBorderTab.options[1]?.text).toContain("(saved)");
  });

  it("auto-saves when enable checkbox is toggled", async () => {
    const { profileBorderEnabled } = getElements();
    profileBorderEnabled.checked = true;
    profileBorderEnabled.dispatchEvent(new Event("change"));
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      profileBorderOpen: { enabled: true, openInNewTab: true },
    });
  });

  it("shows the tab field on init when enabled is saved as true", async () => {
    vi.resetModules();
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      profileBorderOpen: { enabled: true, openInNewTab: false },
      profileBorderSectionOpen: false,
      geoOverride: { enabled: false, latitude: 0, longitude: 0 },
      geoSectionOpen: false,
      guid: "",
      phone: "",
    });
    document.body.innerHTML = POPUP_HTML;
    await import("./popup.js");
    await flushPromises();
    const field = document.getElementById("profile-border-tab-field") as HTMLElement;
    expect(field.style.display).toBe("");
  });
});

describe("popup — favorites", () => {
  beforeEach(loadModule);

  it("checkbox is unchecked and disabled on init when FAVORITES_NOTIFICATIONS_ENABLED is false", () => {
    const { favoritesEnabled } = getElements();
    expect(favoritesEnabled.checked).toBe(false);
    expect(favoritesEnabled.disabled).toBe(true);
  });

  it("shows coming soon hint when FAVORITES_NOTIFICATIONS_ENABLED is false", () => {
    const { favoritesHint } = getElements();
    expect(favoritesHint.textContent).toBe("Coming soon!");
  });

  it("strikes through enable label when FAVORITES_NOTIFICATIONS_ENABLED is false", () => {
    const { favoritesEnableLabel } = getElements();
    expect(favoritesEnableLabel.style.textDecoration).toBe("line-through");
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

describe("popup — geo fields visibility", () => {
  beforeEach(loadModule);

  it("hides geo fields on init when disabled", () => {
    const { geoFields } = getElements();
    expect(geoFields.style.display).toBe("none");
  });

  it("shows geo fields when enable is checked", () => {
    const { geoEnabled, geoFields } = getElements();
    geoEnabled.checked = true;
    geoEnabled.dispatchEvent(new Event("change"));
    expect(geoFields.style.display).toBe("");
  });

  it("hides geo fields when enable is unchecked", () => {
    const { geoEnabled, geoFields } = getElements();
    geoEnabled.checked = true;
    geoEnabled.dispatchEvent(new Event("change"));
    geoEnabled.checked = false;
    geoEnabled.dispatchEvent(new Event("change"));
    expect(geoFields.style.display).toBe("none");
  });

  it("hides save button on init when lat and lng are empty", () => {
    const { geoSave } = getElements();
    expect(geoSave.style.display).toBe("none");
  });

  it("shows save button when both lat and lng are filled", () => {
    const { geoLat, geoLng, geoSave } = getElements();
    geoLat.value = "40.7128";
    geoLat.dispatchEvent(new Event("input"));
    geoLng.value = "-74.006";
    geoLng.dispatchEvent(new Event("input"));
    expect(geoSave.style.display).toBe("");
  });

  it("hides save button when lat is cleared", () => {
    const { geoLat, geoLng, geoSave } = getElements();
    geoLat.value = "40.7128";
    geoLat.dispatchEvent(new Event("input"));
    geoLng.value = "-74.006";
    geoLng.dispatchEvent(new Event("input"));
    geoLat.value = "";
    geoLat.dispatchEvent(new Event("input"));
    expect(geoSave.style.display).toBe("none");
  });

  it("shows fields and save button on init when geo is saved as enabled with coords", async () => {
    vi.resetModules();
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      geoOverride: { enabled: true, latitude: 40.7128, longitude: -74.006 },
      geoSectionOpen: false,
      profileBorderOpen: { enabled: false, openInNewTab: false },
      profileBorderSectionOpen: false,
      favoritesEnabled: false,
      favoritesSectionOpen: false,
      guid: "",
      phone: "",
    });
    document.body.innerHTML = POPUP_HTML;
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: vi.fn() },
      writable: true,
      configurable: true,
    });
    await import("./popup.js");
    await flushPromises();
    const geoFields = document.getElementById("geo-fields") as HTMLElement;
    expect(geoFields.style.display).toBe("");
  });
});

describe("popup — geo override", () => {
  beforeEach(loadModule);

  it("saves geo form values when save is clicked", async () => {
    const { geoLat, geoLng, geoSave } = getElements();
    geoLat.value = "40.7128";
    geoLng.value = "-74.0060";
    geoSave.click();
    await flushPromises();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      geoOverride: { enabled: false, latitude: 40.7128, longitude: -74.006 },
    });
  });

  it("shows geo status while getting location", () => {
    const { geoFillCurrent, geoStatus } = getElements();
    geoFillCurrent.click();
    expect(geoStatus.textContent).toBe("Getting location…");
  });
});

describe("popup — section persistence", () => {
  beforeEach(loadModule);

  it("saves geo section open state on toggle", () => {
    const { geoDetails } = getElements();
    geoDetails.open = true;
    geoDetails.dispatchEvent(new Event("toggle"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ geoSectionOpen: true });
  });

  it("saves profile border section open state on toggle", () => {
    const { profileBorderDetails } = getElements();
    profileBorderDetails.open = true;
    profileBorderDetails.dispatchEvent(new Event("toggle"));
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ profileBorderSectionOpen: true });
  });
});
