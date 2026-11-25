import { afterEach, beforeEach, vi } from "vitest";
import { installProfileFiltersMenu } from "./menu.js";
import { STRINGS } from "../strings.js";
import {
  parseProfileFilters,
  type Gender,
  type ProfileFilters,
  type RangeFilter,
} from "../profile-filter.js";

export const statLine = (key: string, title: string, last = false): string => `
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

export const MENU_HTML = `
  <filter-group-component>
    <smart-select-filter>
      <div class="smart-options-container active">
        ${statLine("stats.age", "Age")}
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
          <label class="switch filter-group"><input disabled="" type="checkbox" id="CONNECTED_NOW" /></label>
        </div>
      </div>
    </ui-list-item-level-2>
    <filter-type-component _nghost-ng-c1="">
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
              <label class="switch filter-group" data-testid="isProfileTypeSwitchundefined">
                <input disabled="" type="checkbox" id="IS_PROFILE_TYPE" />
                <span class="slider"></span>
              </label>
            </div>
          </div>
          <div class="options-container">
            <span class="select-option" data-testid="isProfileTypePaidOptionButton"></span>
          </div>
        </div>
      </div>
    </filter-type-component>
  </filter-group-component>
`;

export const filters = (overrides: Partial<ProfileFilters> = {}): ProfileFilters => ({
  ...parseProfileFilters(null),
  ...overrides,
});
export const gender = (enabled: boolean, ...genders: Gender[]): Partial<ProfileFilters> => ({
  gender: { enabled, genders },
});
export const range = (overrides: Partial<RangeFilter>): RangeFilter => ({
  enabled: true,
  min: null,
  max: null,
  includeUnspecified: false,
  ...overrides,
});

export const onlineAfter = (time: string): RegExp =>
  new RegExp(`^${STRINGS.filterMenu.cruisersOnlineAfter(time)}${time ? "(PM)?$" : ""}`);

export const row = (id: string): HTMLElement => document.getElementById(`snp-${id}-filter`)!;
export const applyButton = (id: string): HTMLButtonElement =>
  row(id).querySelector<HTMLButtonElement>(".snp-filter-apply")!;

export const genderToggle = (): HTMLInputElement =>
  document.querySelector<HTMLInputElement>("#snp-gender-filter-enabled")!;
export const genderButtons = (): HTMLButtonElement[] => [
  ...row("gender").querySelectorAll<HTMLButtonElement>(".snp-gender-option"),
];
export const activeGenders = (): string[] =>
  genderButtons()
    .filter((b) => b.classList.contains("active"))
    .map((b) => b.dataset.gender!);
export const clickGender = (name: string): void =>
  genderButtons()
    .find((b) => b.dataset.gender === name)!
    .click();

export const statCheckbox = (id: string): HTMLElement =>
  row(id).querySelector<HTMLElement>("label")!;
export const statValue = (id: string): string =>
  row(id).querySelector(".text-value")!.textContent!.trim();
export const isChecked = (id: string): boolean =>
  row(id).querySelector("label i")!.classList.contains("fa-check-square");
export const openSheet = (id: string): void =>
  row(id).querySelector<HTMLElement>(".stat-button")!.click();
export const sheet = (): HTMLElement | null => document.querySelector<HTMLElement>(".snp-flyout");
export const wheelItems = (wheel: string): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`.snp-wheel[data-wheel="${wheel}"] .snp-wheel-item`),
];
export const wheelLabels = (wheel: string): string[] =>
  wheelItems(wheel).map((i) => i.textContent!);
export const pick = (wheel: string, label: string): void =>
  wheelItems(wheel)
    .find((i) => i.textContent === label)!
    .click();
export const picked = (wheel: string): string =>
  wheelItems(wheel).find((i) => i.classList.contains("selected"))!.textContent!;
export const sheetButton = (text: string): HTMLButtonElement =>
  [...sheet()!.querySelectorAll("button")].find((b) => b.textContent === text)!;

export const useMenu = () => {
  let off: () => void = () => {};
  const onChange = vi.fn<(next: ProfileFilters) => void>();
  const install = (
    initial: ProfileFilters,
    extra: { reloadPage?: () => void; applied?: ProfileFilters } = {},
  ): void => {
    off = installProfileFiltersMenu({
      initial,
      applied: extra.applied ?? initial,
      onChange,
      reloadPage: extra.reloadPage,
    });
  };
  const uninstall = (): void => off();
  const lastChange = (): ProfileFilters => onChange.mock.lastCall![0];

  beforeEach(() => {
    onChange.mockClear();
    // No saved account units: the jsdom locale (en-US) is imperial.
    localStorage.clear();
    document.body.innerHTML = MENU_HTML;
  });

  afterEach(() => {
    off();
    document.body.innerHTML = "";
  });

  return { install, uninstall, onChange, lastChange };
};
