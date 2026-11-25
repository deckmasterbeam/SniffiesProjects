import { expect, type Locator, type Page } from "@playwright/test";

const statLine = (key: string, title: string, last = false): string => `
  <ui-menu-item-group variant="level3">
    <div class="menu-item-group${last ? " no-border-bottom" : ""} level3">
      <app-advanced-filter-checkbox>
        <div class="list-item label-only parent-enabled${last ? " last" : ""}">
          <label tabindex="0" class="stat-name clickable" for="${key}" data-testid="${key}Checkbox">
            <i class="fa fa-square"></i><span>${title}</span>
          </label>
          <div class="stat-button">
            <button class="select"><span class="text-value placeholder"> Select </span></button>
            <i class="fa fa-angle-right clickable" data-testid="${key}Arrow"></i>
          </div>
        </div>
      </app-advanced-filter-checkbox>
    </div>
  </ui-menu-item-group>
`;

/** The Cruisers filter menu, trimmed from the live Map Layers markup. */
export const FILTER_MENU_HTML = `
  <filter-group-component>
    <smart-select-filter>
      <div class="smart-options-container active">
        ${statLine("stats.age", "Age")}
        ${statLine("sexuality.attitude", "Position")}
        ${statLine("stats.body", "Body Type")}
        ${statLine("stats.endowment", "Endowment")}
        ${statLine("sexuality.spectrum", "Sexuality", true)}
      </div>
    </smart-select-filter>
    <ui-list-item-level-2>
      <div class="list-item-level-2">
        <div class="content">
          <label for="CONNECTED_NOW" data-testid="connectedNowLabelundefined">
            <i class="fa fa-md fa-plug leading-icon"></i>
            <div class="content-details"><div class="details-title">
              <p class="typography--body"> Cruising Now</p>
            </div></div>
          </label>
        </div>
        <div class="trailing">
          <label class="switch filter-group"><input disabled type="checkbox" id="CONNECTED_NOW" /><span class="slider"></span></label>
        </div>
      </div>
    </ui-list-item-level-2>
    <filter-type-component>
      <div>
        <div class="select-filter">
          <div class="list-item-level-2">
            <div class="content">
              <label for="IS_PROFILE_TYPE" data-testid="isProfileTypeLabelundefined">
                <i class="fa fa-md fa-user leading-icon"></i>
                <p class="typography--body"> Profile Type</p>
              </label>
            </div>
            <div class="trailing">
              <label class="switch filter-group">
                <input disabled type="checkbox" id="IS_PROFILE_TYPE" /><span class="slider"></span>
              </label>
            </div>
          </div>
          <div class="options-container"></div>
        </div>
      </div>
    </filter-type-component>
  </filter-group-component>
`;

/** Where Sniffies saves a filter change. */
export const OPTIONS_PATH = "/api/visitor/current/options";

/**
 * Adds the menu to every page load. Like Sniffies' own, its Cruising Now switch is a disabled
 * checkbox for show: clicking the row is what toggles it and saves the filter.
 */
export const addFilterMenu = (page: Page, { cruisingNow = false } = {}): Promise<unknown> =>
  page.addInitScript(
    ({ html, path, on }) => {
      document.addEventListener("DOMContentLoaded", () => {
        const menu = document.createElement("div");
        menu.innerHTML = html;
        document.body.appendChild(menu);
        const input = document.querySelector<HTMLInputElement>("#CONNECTED_NOW")!;
        input.checked = on;
        input.closest(".list-item-level-2")!.addEventListener("click", () => {
          input.checked = !input.checked;
          void fetch(path, {
            method: "PUT",
            body: JSON.stringify({ filters: { CONNECTED_NOW: input.checked } }),
          });
        });
      });
    },
    { html: FILTER_MENU_HTML, path: OPTIONS_PATH, on: cruisingNow },
  );

/** Like `seedLocalStorage`, but only on a tab's first load, so a reload keeps what was saved. */
export const seedLocalStorageOnce = (page: Page, data: Record<string, string>): Promise<unknown> =>
  page.addInitScript((seed) => {
    if (sessionStorage.getItem("e2e-seeded")) {
      return;
    }
    sessionStorage.setItem("e2e-seeded", "1");
    for (const [key, value] of Object.entries(seed)) {
      localStorage.setItem(key, value);
    }
  }, data);

export const wheelItems = (page: Page, wheel: string): Locator =>
  page.locator(`.snp-wheel[data-wheel="${wheel}"] .snp-wheel-item`);

/** The id (or tag, for Sniffies' own elements) of the element next to one of ours. */
export const neighbour = (
  page: Page,
  id: string,
  side: "previousElementSibling" | "nextElementSibling",
): Promise<string | undefined> =>
  page.locator(`#${id}`).evaluate((el, key) => el[key]?.id || el[key]?.tagName, side);

/** Clicks a row's Reload to apply, and waits for the page it reloads into to have its menu. */
export const applyAndReload = async (page: Page, rowId: string): Promise<void> => {
  await Promise.all([
    page.waitForEvent("load"),
    page.locator(`#${rowId} .snp-filter-apply`).click(),
  ]);
  await expect(page.locator("#snp-gender-filter")).toBeVisible();
};
