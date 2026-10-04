import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installProfileFiltersMenu } from "./filter-menu-ui.js";
import {
  GENDERS,
  parseProfileFilters,
  type Gender,
  type ProfileFilters,
  type RangeFilter,
} from "./profile-filter.js";

// Trimmed from the live Map Layers → Cruisers menu markup.
const MENU_HTML = `
  <filter-group-component>
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

// jsdom's navigator.language is en-US, so untouched range filters start out imperial.
const filters = (overrides: Partial<ProfileFilters> = {}): ProfileFilters => ({
  ...parseProfileFilters(null),
  ...overrides,
});
const gender = (enabled: boolean, ...genders: Gender[]): Partial<ProfileFilters> => ({
  gender: { enabled, genders },
});
const range = (overrides: Partial<RangeFilter>): RangeFilter => ({
  enabled: true,
  min: null,
  max: null,
  metric: false,
  ...overrides,
});

const row = (id: string): HTMLElement => document.getElementById(`snp-${id}-filter`)!;
const toggle = (id: string): HTMLInputElement =>
  document.querySelector<HTMLInputElement>(`#snp-${id}-filter-enabled`)!;
const applyButton = (id: string): HTMLButtonElement =>
  row(id).querySelector<HTMLButtonElement>(".snp-filter-apply")!;
const select = (id: string, bound: string): HTMLSelectElement =>
  row(id).querySelector<HTMLSelectElement>(`select[data-bound="${bound}"]`)!;
const choose = (id: string, bound: string, label: string): void => {
  const node = select(id, bound);
  node.value = [...node.options].find((o) => o.text === label)!.value;
  node.dispatchEvent(new Event("change"));
};
const shown = (id: string, bound: string): string => select(id, bound).selectedOptions[0]!.text;

const genderButtons = (): HTMLButtonElement[] => [
  ...row("gender").querySelectorAll<HTMLButtonElement>(".snp-gender-option"),
];
const activeGenders = (): string[] =>
  genderButtons()
    .filter((b) => b.classList.contains("active"))
    .map((b) => b.dataset.gender!);
const clickGender = (name: string): void =>
  genderButtons()
    .find((b) => b.dataset.gender === name)!
    .click();

describe("installProfileFiltersMenu", () => {
  let uninstall: () => void;
  let onChange: ReturnType<typeof vi.fn<(next: ProfileFilters) => void>>;
  const install = (
    initial: ProfileFilters,
    extra: { reloadPage?: () => void; applied?: ProfileFilters } = {},
  ): void => {
    uninstall = installProfileFiltersMenu({
      initial,
      applied: extra.applied ?? initial,
      onChange,
      reloadPage: extra.reloadPage,
    });
  };
  const lastChange = (): ProfileFilters => onChange.mock.lastCall![0];

  beforeEach(() => {
    onChange = vi.fn();
    document.body.innerHTML = MENU_HTML;
  });

  afterEach(() => {
    uninstall();
    document.body.innerHTML = "";
  });

  describe("rows", () => {
    it("mounts Gender, Height and Weight after Profile Type without touching Sniffies' own row", () => {
      install(filters());
      const rows = [...document.querySelectorAll("filter-type-component")];
      expect(rows.map((r) => r.querySelector("p")?.textContent)).toEqual([
        " Profile Type",
        " Gender",
        " Height",
        " Weight",
      ]);
      expect(rows[0]!.querySelector("label")?.getAttribute("for")).toBe("IS_PROFILE_TYPE");
      expect(document.querySelectorAll("#IS_PROFILE_TYPE")).toHaveLength(1);
      expect(row("gender").querySelector("[data-testid]")).toBeNull();
    });

    it("gives each row its own working on/off switch, wired to the row's title", () => {
      install(filters(gender(false, "female")));
      expect(toggle("gender").disabled).toBe(false);
      expect(toggle("gender").checked).toBe(false);
      expect(row("gender").querySelector("label")?.getAttribute("for")).toBe(
        "snp-gender-filter-enabled",
      );

      toggle("gender").click();
      expect(lastChange().gender).toEqual({ enabled: true, genders: ["female"] });
      expect(row("gender").querySelector(".list-item-level-2")?.classList).toContain("active");
      expect(applyButton("gender").hidden).toBe(false);
      // The other rows are unaffected.
      expect(toggle("height").checked).toBe(false);
      expect(applyButton("height").hidden).toBe(true);

      toggle("gender").click();
      expect(lastChange().gender.enabled).toBe(false);
      expect(applyButton("gender").hidden).toBe(true);
    });

    it("offers a reload straight away when a row differs from what the page loaded with", () => {
      const reloadPage = vi.fn();
      install(filters(gender(true, "female")), { applied: filters(), reloadPage });
      expect(applyButton("gender").hidden).toBe(false);
      applyButton("gender").click();
      expect(reloadPage).toHaveBeenCalledOnce();
    });

    it("re-mounts with the current state when Sniffies rebuilds the menu", async () => {
      install(filters(gender(false, "male", "female")));
      clickGender("male");
      toggle("gender").click();
      choose("height", "min", `5'10"`);
      document.body.innerHTML = "";
      document.body.innerHTML = MENU_HTML;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(activeGenders()).toEqual(["female"]);
      expect(toggle("gender").checked).toBe(true);
      expect(applyButton("gender").hidden).toBe(false);
      expect(shown("height", "min")).toBe(`5'10"`);
    });

    it("removes the rows and stops re-mounting when uninstalled", async () => {
      install(filters());
      uninstall();
      expect(document.querySelector(".snp-filter-row")).toBeNull();
      document.body.innerHTML = MENU_HTML;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(document.querySelector(".snp-filter-row")).toBeNull();
    });

    it("does nothing when the menu isn't open", () => {
      document.body.innerHTML = "";
      install(filters());
      expect(document.querySelector(".snp-filter-row")).toBeNull();
    });
  });

  describe("gender", () => {
    it("shows one button per gender, with the selected ones active", () => {
      install(filters(gender(true, "male", "female")));
      expect(genderButtons().map((b) => b.textContent)).toEqual([
        "Male",
        "Female",
        "Nonbinary",
        "Not specified",
      ]);
      expect(activeGenders()).toEqual(["male", "female"]);
    });

    it("toggles genders while on and offers a reload", () => {
      install(filters(gender(true, ...GENDERS)));
      clickGender("male");
      expect(lastChange().gender.genders).toEqual(["female", "nonbinary", "undefined"]);
      expect(applyButton("gender").hidden).toBe(false);
      clickGender("male");
      expect(lastChange().gender.genders).toEqual([...GENDERS]);
      expect(applyButton("gender").hidden).toBe(true);
    });

    it("keeps the selection while off, and changing it then needs no reload", () => {
      install(filters(gender(false, ...GENDERS)));
      clickGender("male");
      expect(lastChange().gender).toEqual({
        enabled: false,
        genders: ["female", "nonbinary", "undefined"],
      });
      expect(applyButton("gender").hidden).toBe(true);
    });

    it("refuses to deselect the last remaining gender", () => {
      install(filters(gender(true, "female")));
      clickGender("female");
      expect(activeGenders()).toEqual(["female"]);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("height and weight", () => {
    it("offers Sniffies' ranges: height in 1in steps, weight in 5lb steps", () => {
      install(filters());
      const labels = (id: string, bound: string): string[] =>
        [...select(id, bound).options].map((o) => o.text);
      const heights = labels("height", "min");
      expect(heights.slice(0, 3)).toEqual(["No min", `4'0"`, `4'1"`]);
      expect(heights.at(-1)).toBe(`7'0" +`);
      expect(heights).toHaveLength(1 + 37);
      expect(labels("height", "max").at(-1)).toBe(`7'0"`);
      const weights = labels("weight", "max");
      expect(weights.slice(0, 3)).toEqual(["No max", "90lb", "95lb"]);
      expect(weights.at(-1)).toBe("400lb");
      expect(weights).toHaveLength(1 + 63);
    });

    it("offers metric ranges when switched: height in 1cm steps, weight in 5kg steps", () => {
      install(filters({ height: range({ metric: true }), weight: range({ metric: true }) }));
      const labels = (id: string): string[] => [...select(id, "min").options].map((o) => o.text);
      expect(labels("height").slice(1, 3)).toEqual(["120cm", "121cm"]);
      expect(labels("height").at(-1)).toBe("210cm +");
      expect(labels("weight").slice(1, 3)).toEqual(["40kg", "45kg"]);
      expect(labels("weight").at(-1)).toBe("180kg +");
    });

    it("stores the chosen bounds in Sniffies' units, rounded the way Sniffies rounds", () => {
      install(filters({ height: range({}), weight: range({}) }));
      choose("height", "min", `5'10"`);
      choose("height", "max", `6'3"`);
      expect(lastChange().height).toEqual(range({ min: 178, max: 191 }));
      choose("weight", "min", "150lb");
      choose("weight", "max", "175lb");
      expect(lastChange().weight).toEqual(range({ min: 68, max: 79 }));
      expect(applyButton("height").hidden).toBe(false);
      expect(applyButton("weight").hidden).toBe(false);
    });

    it("needs no reload while the row is off or has no bounds", () => {
      install(filters());
      choose("height", "min", `5'10"`);
      expect(lastChange().height.min).toBe(178);
      expect(applyButton("height").hidden).toBe(true);
      toggle("weight").click();
      expect(applyButton("weight").hidden).toBe(true);
    });

    it("drags the other bound along rather than allowing min above max", () => {
      install(filters({ weight: range({ min: 68, max: 79 }) }));
      choose("weight", "min", "200lb");
      expect(lastChange().weight).toMatchObject({ min: 91, max: 91 });
      expect(shown("weight", "max")).toBe("200lb");
      choose("weight", "max", "150lb");
      expect(lastChange().weight).toMatchObject({ min: 68, max: 68 });
    });

    it("switching units re-labels the choices and snaps the bounds onto them", () => {
      install(filters({ weight: range({ min: 68, max: null }) }));
      expect(shown("weight", "min")).toBe("150lb");
      choose("weight", "unit", "kg");
      expect(lastChange().weight).toEqual(range({ min: 70, max: null, metric: true }));
      expect(shown("weight", "min")).toBe("70kg");
      expect(shown("weight", "max")).toBe("No max");
    });
  });
});
