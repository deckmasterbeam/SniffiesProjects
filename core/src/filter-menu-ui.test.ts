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
const statLine = (key: string, title: string, last = false): string => `
  <ui-menu-item-group variant="level3">
    <div class="menu-item-group${last ? " no-border-bottom" : ""} level3">
      <app-advanced-filter-checkbox>
        <div class="list-item label-only${last ? " last" : ""}">
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

const MENU_HTML = `
  <filter-group-component>
    <smart-select-filter>
      <div class="smart-options-container">
        ${statLine("stats.age", "Age")}
        ${statLine("stats.endowment", "Endowment")}
        ${statLine("sexuality.spectrum", "Sexuality", true)}
      </div>
    </smart-select-filter>
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
const applyButton = (id: string): HTMLButtonElement =>
  row(id).querySelector<HTMLButtonElement>(".snp-filter-apply")!;

const genderToggle = (): HTMLInputElement =>
  document.querySelector<HTMLInputElement>("#snp-gender-filter-enabled")!;
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

// Stat lines (Height / Weight) and the sheet they open.
const statCheckbox = (id: string): HTMLElement => row(id).querySelector<HTMLElement>("label")!;
const statValue = (id: string): string => row(id).querySelector(".text-value")!.textContent!.trim();
const isChecked = (id: string): boolean =>
  row(id).querySelector("label i")!.classList.contains("fa-check-square");
const openSheet = (id: string): void => row(id).querySelector<HTMLElement>(".stat-button")!.click();
const sheet = (): HTMLElement | null => document.querySelector<HTMLElement>(".snp-flyout");
const wheelItems = (wheel: string): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`.snp-wheel[data-wheel="${wheel}"] .snp-wheel-item`),
];
const wheelLabels = (wheel: string): string[] => wheelItems(wheel).map((i) => i.textContent!);
const pick = (wheel: string, label: string): void =>
  wheelItems(wheel)
    .find((i) => i.textContent === label)!
    .click();
const picked = (wheel: string): string =>
  wheelItems(wheel).find((i) => i.classList.contains("selected"))!.textContent!;
const sheetButton = (text: string): HTMLButtonElement =>
  [...sheet()!.querySelectorAll("button")].find((b) => b.textContent === text)!;

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

  describe("placement", () => {
    it("mounts Gender after Profile Type without touching Sniffies' own row", () => {
      install(filters());
      const rows = [...document.querySelectorAll("filter-type-component")];
      expect(rows.map((r) => r.querySelector("p")?.textContent)).toEqual([
        " Profile Type",
        " Gender",
      ]);
      expect(rows[0]!.querySelector("label")?.getAttribute("for")).toBe("IS_PROFILE_TYPE");
      expect(document.querySelectorAll("#IS_PROFILE_TYPE")).toHaveLength(1);
      expect(row("gender").querySelector("[data-testid]")).toBeNull();
    });

    it("mounts Height and Weight after Endowment, inside the Cruiser Stats options", () => {
      install(filters());
      const lines = [...document.querySelectorAll(".smart-options-container > *")];
      expect(lines.map((l) => l.querySelector("label span")?.textContent)).toEqual([
        "Age",
        "Endowment",
        "Height",
        "Weight",
        "Sexuality",
      ]);
      expect(row("height").tagName).toBe("UI-MENU-ITEM-GROUP");
      expect(row("height").querySelector("label")?.hasAttribute("for")).toBe(false);
      expect(row("height").querySelector("[data-testid]")).toBeNull();
      expect(document.querySelectorAll('label[for="stats.endowment"]')).toHaveLength(1);
    });

    it("still mounts Gender when the Cruiser Stats lines aren't there", () => {
      document.querySelector("smart-select-filter")!.remove();
      install(filters());
      expect(row("gender")).not.toBeNull();
      expect(row("height")).toBeNull();
    });

    it("re-mounts with the current state when Sniffies rebuilds the menu", async () => {
      install(filters(gender(false, "male", "female")));
      clickGender("male");
      genderToggle().click();
      openSheet("height");
      pick("min", `5'10"`);
      sheetButton("Done").click();
      document.body.innerHTML = "";
      document.body.innerHTML = MENU_HTML;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(activeGenders()).toEqual(["female"]);
      expect(genderToggle().checked).toBe(true);
      expect(applyButton("gender").hidden).toBe(false);
      expect(statValue("height")).toBe(`5'10" +`);
      expect(isChecked("height")).toBe(true);
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
    it("has its own working on/off switch, wired to the row's title", () => {
      install(filters(gender(false, "female")));
      expect(genderToggle().disabled).toBe(false);
      expect(genderToggle().checked).toBe(false);
      expect(row("gender").querySelector("label")?.getAttribute("for")).toBe(
        "snp-gender-filter-enabled",
      );

      genderToggle().click();
      expect(lastChange().gender).toEqual({ enabled: true, genders: ["female"] });
      expect(row("gender").querySelector(".list-item-level-2")?.classList).toContain("active");
      expect(applyButton("gender").hidden).toBe(false);
      // The other rows are unaffected.
      expect(applyButton("height").hidden).toBe(true);

      genderToggle().click();
      expect(lastChange().gender.enabled).toBe(false);
      expect(applyButton("gender").hidden).toBe(true);
    });

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

    it("offers a reload straight away when it differs from what the page loaded with", () => {
      const reloadPage = vi.fn();
      install(filters(gender(true, "female")), { applied: filters(), reloadPage });
      expect(applyButton("gender").hidden).toBe(false);
      applyButton("gender").click();
      expect(reloadPage).toHaveBeenCalledOnce();
    });
  });

  describe("height and weight lines", () => {
    it("look like an unset Sniffies stat line until a range is picked", () => {
      install(filters());
      expect(statValue("height")).toBe("Select");
      expect(row("height").querySelector("button")!.className).toBe("select");
      expect(row("height").querySelector(".text-value")!.classList).toContain("placeholder");
      expect(isChecked("height")).toBe(false);
      // Independent of Sniffies' own Cruiser Stats switch.
      expect(row("height").querySelector(".list-item")!.classList).toContain("parent-enabled");
    });

    it("show the range and a ticked checkbox once set", () => {
      install(
        filters({
          height: range({ min: 178, max: 191 }),
          weight: range({ min: null, max: 80, metric: true }),
        }),
      );
      expect(statValue("height")).toBe(`5'10" - 6'3"`);
      expect(row("height").querySelector("button")!.className).toBe("range");
      expect(row("height").querySelector(".text-value")!.classList).not.toContain("placeholder");
      expect(isChecked("height")).toBe(true);
      expect(statCheckbox("height").classList).toContain("active");
      expect(row("height").querySelector(".stat-button")!.classList).toContain("active");
      expect(statValue("weight")).toBe("Up to 80kg");
    });

    it("clicking the checkbox switches a set range off and on, keeping the range", () => {
      install(filters({ weight: range({ min: 68, max: 79 }) }));
      statCheckbox("weight").click();
      expect(lastChange().weight).toEqual(range({ enabled: false, min: 68, max: 79 }));
      expect(isChecked("weight")).toBe(false);
      expect(statValue("weight")).toBe("150lb - 175lb");
      expect(applyButton("weight").hidden).toBe(false);
      statCheckbox("weight").click();
      expect(lastChange().weight.enabled).toBe(true);
      expect(applyButton("weight").hidden).toBe(true);
    });

    it("clicking the checkbox with no range set opens the sheet instead", () => {
      install(filters());
      statCheckbox("height").click();
      expect(sheet()).not.toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("height and weight reload button", () => {
    const rangeButton = (id: string): HTMLElement =>
      row(id).querySelector<HTMLElement>(".stat-button > button:not(.snp-filter-apply)")!;

    it("takes the range button's place while there's something to apply", () => {
      const reloadPage = vi.fn();
      install(filters({ height: range({ min: 178 }) }), { reloadPage });
      expect(rangeButton("height").style.display).toBe("");
      expect(applyButton("height").hidden).toBe(true);

      statCheckbox("height").click();
      expect(rangeButton("height").style.display).toBe("none");
      expect(applyButton("height").hidden).toBe(false);
      expect(applyButton("height").previousElementSibling).toBe(rangeButton("height"));
      // The arrow is still there to reopen the sheet.
      expect(row("height").querySelector(".stat-button .fa-angle-right")).not.toBeNull();

      applyButton("height").click();
      expect(reloadPage).toHaveBeenCalledOnce();
      expect(sheet()).toBeNull();
    });

    it("gives the range button back once there's nothing to apply", () => {
      install(filters({ height: range({ min: 178 }) }));
      statCheckbox("height").click();
      statCheckbox("height").click();
      expect(rangeButton("height").style.display).toBe("");
      expect(applyButton("height").hidden).toBe(true);
    });
  });

  describe("range sheet", () => {
    it("opens from the line with Cancel / title / Done and unit, min and max wheels", () => {
      install(filters());
      openSheet("height");
      expect(sheet()!.querySelector("h1")!.textContent).toBe("Height");
      expect(sheet()!.getAttribute("aria-label")).toBe("Height: Make a Selection");
      expect([...sheet()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
        "Cancel",
        "Done",
      ]);
      expect(wheelLabels("unit")).toEqual(["ft", "cm"]);
      expect(picked("unit")).toBe("ft");
      expect(picked("min")).toBe("-");
      expect(picked("max")).toBe("-");
    });

    it("offers Sniffies' ranges: height in 1in steps, weight in 5lb steps", () => {
      install(filters());
      openSheet("height");
      const heights = wheelLabels("min");
      expect(heights.slice(0, 3)).toEqual(["-", `4'0"`, `4'1"`]);
      expect(heights.at(-1)).toBe(`7'0" +`);
      expect(heights).toHaveLength(1 + 37);
      expect(wheelLabels("max").at(-1)).toBe(`7'0"`);
      sheetButton("Cancel").click();

      openSheet("weight");
      const weights = wheelLabels("max");
      expect(weights.slice(0, 3)).toEqual(["-", "90lb", "95lb"]);
      expect(weights.at(-1)).toBe("400lb");
      expect(weights).toHaveLength(1 + 63);
    });

    it("offers metric ranges on the unit wheel: height in 1cm steps, weight in 5kg steps", () => {
      install(filters());
      openSheet("height");
      pick("unit", "cm");
      expect(wheelLabels("min").slice(1, 3)).toEqual(["120cm", "121cm"]);
      expect(wheelLabels("min").at(-1)).toBe("210cm +");
      sheetButton("Cancel").click();

      openSheet("weight");
      pick("unit", "kg");
      expect(wheelLabels("min").slice(1, 3)).toEqual(["40kg", "45kg"]);
      expect(wheelLabels("min").at(-1)).toBe("180kg +");
    });

    it("Done stores the range in Sniffies' units, switches the filter on and closes", () => {
      install(filters());
      openSheet("height");
      pick("min", `5'10"`);
      pick("max", `6'3"`);
      sheetButton("Done").click();
      expect(sheet()).toBeNull();
      expect(lastChange().height).toEqual(range({ min: 178, max: 191 }));
      expect(statValue("height")).toBe(`5'10" - 6'3"`);
      expect(isChecked("height")).toBe(true);
      expect(applyButton("height").hidden).toBe(false);

      openSheet("weight");
      pick("min", "150lb");
      pick("max", "175lb");
      sheetButton("Done").click();
      expect(lastChange().weight).toEqual(range({ min: 68, max: 79 }));
    });

    it("reopens on the current range", () => {
      install(filters({ weight: range({ min: 68, max: 79 }) }));
      openSheet("weight");
      expect(picked("min")).toBe("150lb");
      expect(picked("max")).toBe("175lb");
    });

    it("Cancel, Escape and a click outside the sheet all close it without changing anything", () => {
      install(filters());
      for (const dismiss of [
        () => sheetButton("Cancel").click(),
        () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
        () => document.querySelector<HTMLElement>(".snp-flyout-backdrop")!.click(),
      ]) {
        openSheet("height");
        pick("min", `5'10"`);
        dismiss();
        expect(sheet()).toBeNull();
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(statValue("height")).toBe("Select");
    });

    it("Done with both ends left open switches the filter off", () => {
      install(filters({ height: range({ min: 178 }) }));
      openSheet("height");
      pick("min", "-");
      sheetButton("Done").click();
      expect(lastChange().height).toEqual(range({ enabled: false }));
      expect(statValue("height")).toBe("Select");
    });

    it("pushes max up ahead of min as min is scrolled past it", () => {
      install(filters({ weight: range({ min: 68, max: 79 }) }));
      openSheet("weight");
      pick("min", "170lb");
      expect(picked("max")).toBe("175lb");
      pick("min", "175lb");
      expect(picked("max")).toBe("180lb");
      pick("min", "300lb");
      expect(picked("max")).toBe("305lb");
      sheetButton("Done").click();
      expect(lastChange().weight).toMatchObject({ min: 136, max: 138 });
    });

    it("pushes min down ahead of max as max is scrolled past it", () => {
      install(filters({ height: range({ min: 178, max: 191 }) }));
      openSheet("height");
      pick("max", `5'11"`);
      expect(picked("min")).toBe(`5'10"`);
      pick("max", `5'10"`);
      expect(picked("min")).toBe(`5'9"`);
      pick("max", `5'0"`);
      expect(picked("min")).toBe(`4'11"`);
    });

    it("pushes the other wheel off the end to '-' when there's nowhere left to go", () => {
      install(filters({ weight: range({ min: 68, max: 79 }) }));
      openSheet("weight");
      pick("min", "400lb +");
      expect(picked("max")).toBe("-");
      pick("max", "90lb");
      expect(picked("min")).toBe("-");
    });

    it("leaves the other wheel alone while it's open-ended or already clear", () => {
      install(filters({ weight: range({ min: 68 }) }));
      openSheet("weight");
      pick("min", "300lb");
      expect(picked("max")).toBe("-");
      pick("max", "350lb");
      expect(picked("min")).toBe("300lb");
      pick("min", "-");
      expect(picked("max")).toBe("350lb");
    });

    it("switching the unit wheel keeps the picked range, snapped to the new unit's choices", () => {
      install(filters({ weight: range({ min: 68 }) }));
      openSheet("weight");
      pick("unit", "kg");
      expect(picked("min")).toBe("70kg");
      expect(picked("max")).toBe("-");
      sheetButton("Done").click();
      expect(lastChange().weight).toEqual(range({ min: 70, metric: true }));
      expect(statValue("weight")).toBe("70kg +");
    });

    it("mounts where Sniffies puts its own sheets: as a child of the stats filter", () => {
      install(filters());
      openSheet("height");
      const mounted = document.getElementById("snp-range-flyout")!;
      expect(mounted.parentElement).toBe(document.querySelector("smart-select-filter"));
      sheetButton("Cancel").click();
      expect(document.getElementById("snp-range-flyout")).toBeNull();
    });

    it("doesn't let clicks in the sheet reach Sniffies' close-on-outside-click handler", () => {
      install(filters());
      const outside = vi.fn();
      document.addEventListener("click", outside);
      openSheet("height");
      pick("min", `5'10"`);
      document.removeEventListener("click", outside);
      // Only the click that opened the sheet (inside Sniffies' menu) got through.
      expect(outside).toHaveBeenCalledOnce();
    });
  });
});
