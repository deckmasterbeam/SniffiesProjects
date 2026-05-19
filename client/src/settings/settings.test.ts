import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCAL_SETTINGS } from "../shared/settings.js";

const SETTINGS_HTML = `
  <main class="page">
    <section class="phone-section">
      <input id="phone-input" type="tel" />
      <button id="phone-save" type="button"></button>
      <p id="phone-status"></p>
    </section>
    <section class="recovery-section">
      <button id="send-guid-btn" type="button"></button>
      <p id="recovery-status"></p>
      <input id="code-input" type="text" />
      <button id="code-save" type="button"></button>
    </section>
    <section class="favorites-section">
      <p id="summary"></p>
      <div id="grid"></div>
    </section>
    <section class="reset-section">
      <button id="reset-btn" type="button"></button>
      <p id="reset-status"></p>
    </section>
    <section class="storage-section">
      <button id="storage-view-btn" type="button">Show data</button>
      <table id="storage-table" style="display: none;">
        <thead><tr><th>Key</th><th>Value</th></tr></thead>
        <tbody id="storage-table-body"></tbody>
      </table>
    </section>
    <template id="card-template">
      <article class="card">
        <div class="card-image" data-role="image"></div>
        <div class="card-body">
          <div class="card-id" data-role="user-id"></div>
          <div class="card-meta" data-role="favorited-at"></div>
          <button class="unfavorite-btn" data-role="unfavorite" type="button">Remove</button>
        </div>
      </article>
    </template>
  </main>
`;

const flushPromises = () => new Promise<void>((r) => setTimeout(r, 0));

const getElements = () => ({
  resetBtn: document.getElementById("reset-btn") as HTMLButtonElement,
  resetStatus: document.getElementById("reset-status") as HTMLElement,
  storageViewBtn: document.getElementById("storage-view-btn") as HTMLButtonElement,
  storageTable: document.getElementById("storage-table") as HTMLTableElement,
  storageTableBody: document.getElementById("storage-table-body") as HTMLElement,
});

const loadModule = async () => {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
  document.body.innerHTML = SETTINGS_HTML;
  await import("./settings.js");
  await flushPromises();
};

describe("settings — reset", () => {
  beforeEach(loadModule);
  afterEach(() => vi.useRealTimers());

  it("calls clear then set with defaults when reset is clicked", async () => {
    const { resetBtn } = getElements();
    resetBtn.click();
    await flushPromises();
    expect(chrome.storage.local.clear).toHaveBeenCalledOnce();
    expect(chrome.storage.local.set).toHaveBeenCalledWith(DEFAULT_LOCAL_SETTINGS);
  });

  it("shows a confirmation status after reset", async () => {
    const { resetBtn, resetStatus } = getElements();
    resetBtn.click();
    await flushPromises();
    expect(resetStatus.textContent).toContain("Reset");
  });

  it("clears the status text after 10 seconds", async () => {
    vi.useFakeTimers();
    const { resetBtn, resetStatus } = getElements();
    resetBtn.click();
    // flush microtasks from async storage mocks without relying on setTimeout
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(resetStatus.textContent).toContain("Reset");
    vi.advanceTimersByTime(10_000);
    expect(resetStatus.textContent).toBe("");
  });

  it("re-enables the button after reset completes", async () => {
    const { resetBtn } = getElements();
    resetBtn.click();
    await flushPromises();
    expect(resetBtn.disabled).toBe(false);
  });
});

describe("settings — storage view", () => {
  beforeEach(loadModule);

  it("shows the table when Show data is clicked", async () => {
    const { storageViewBtn, storageTable } = getElements();
    storageViewBtn.click();
    await flushPromises();
    expect(storageTable.style.display).toBe("");
  });

  it("renders a row for each key in local settings", async () => {
    const { storageViewBtn, storageTableBody } = getElements();
    storageViewBtn.click();
    await flushPromises();
    expect(storageTableBody.querySelectorAll("tr").length).toBe(
      Object.keys(DEFAULT_LOCAL_SETTINGS).length,
    );
  });

  it("renders the correct keys", async () => {
    const { storageViewBtn, storageTableBody } = getElements();
    storageViewBtn.click();
    await flushPromises();
    const keys = Array.from(storageTableBody.querySelectorAll("tr td:first-child")).map(
      (td) => td.textContent,
    );
    for (const key of Object.keys(DEFAULT_LOCAL_SETTINGS)) {
      expect(keys).toContain(key);
    }
  });

  it("hides the table and resets button text when Hide data is clicked", async () => {
    const { storageViewBtn, storageTable } = getElements();
    storageViewBtn.click();
    await flushPromises();
    storageViewBtn.click();
    await flushPromises();
    expect(storageTable.style.display).toBe("none");
    expect(storageViewBtn.textContent).toBe("Show data");
  });

  it("updates button text to Hide data when table is shown", async () => {
    const { storageViewBtn } = getElements();
    storageViewBtn.click();
    await flushPromises();
    expect(storageViewBtn.textContent).toBe("Hide data");
  });

  it("re-renders table rows after reset when table is visible", async () => {
    const { storageViewBtn, storageTable, storageTableBody, resetBtn } = getElements();
    storageViewBtn.click();
    await flushPromises();
    const rowsBefore = storageTableBody.querySelectorAll("tr").length;
    resetBtn.click();
    await flushPromises();
    expect(storageTable.style.display).toBe("");
    expect(storageTableBody.querySelectorAll("tr").length).toBe(rowsBefore);
  });
});
