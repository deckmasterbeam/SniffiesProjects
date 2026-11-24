import { describe, expect, it, vi } from "vitest";
import {
  filters,
  gender,
  row,
  applyButton,
  genderToggle,
  genderButtons,
  activeGenders,
  clickGender,
  useMenu,
} from "./test-kit.js";
import { STRINGS } from "../strings.js";
import { GENDERS } from "../profile-filter.js";

describe("installProfileFiltersMenu", () => {
  const { install, onChange, lastChange } = useMenu();

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
        STRINGS.filterMenu.male,
        STRINGS.filterMenu.female,
        STRINGS.filterMenu.nonbinary,
        STRINGS.filterMenu.notSpecified,
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
});
