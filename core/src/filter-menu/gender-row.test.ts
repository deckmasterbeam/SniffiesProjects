import {
  activeGenders,
  applyButton,
  clickGender,
  filters,
  gender,
  genderButtons,
  genderToggle,
  row,
  useMenu,
} from "@core/filter-menu/test-kit.js";
import { GENDERS } from "@core/profile-filter.js";
import { STRINGS } from "@core/strings.js";
import { describe, expect, it, vi } from "vitest";

describe("installProfileFiltersMenu", () => {
  const { install, onChange, lastChange } = useMenu();

  describe("gender", () => {
    it("has its own working on/off switch, wired to the row's title", () => {
      install(filters(gender(false, "woman")));
      expect(genderToggle().disabled).toBe(false);
      expect(genderToggle().checked).toBe(false);
      expect(row("gender").querySelector("label")?.getAttribute("for")).toBe(
        "snp-gender-filter-enabled",
      );

      genderToggle().click();
      expect(lastChange().gender).toEqual({ enabled: true, genders: ["woman"] });
      expect(row("gender").querySelector(".list-item-level-2")?.classList).toContain("active");
      expect(applyButton("gender").hidden).toBe(false);
      // The other rows are unaffected.
      expect(applyButton("height").hidden).toBe(true);

      genderToggle().click();
      expect(lastChange().gender.enabled).toBe(false);
      expect(applyButton("gender").hidden).toBe(true);
    });

    it("shows one button per gender, with the selected ones active", () => {
      install(filters(gender(true, "man", "woman")));
      expect(genderButtons().map((b) => b.textContent)).toEqual([
        STRINGS.filterMenu.man,
        STRINGS.filterMenu.woman,
        STRINGS.filterMenu.nonbinary,
        STRINGS.filterMenu.notSpecified,
      ]);
      expect(activeGenders()).toEqual(["man", "woman"]);
    });

    it("toggles genders while on and offers a reload", () => {
      install(filters(gender(true, ...GENDERS)));
      clickGender("man");
      expect(lastChange().gender.genders).toEqual(["woman", "nonbinary", "undefined"]);
      expect(applyButton("gender").hidden).toBe(false);
      clickGender("man");
      expect(lastChange().gender.genders).toEqual([...GENDERS]);
      expect(applyButton("gender").hidden).toBe(true);
    });

    it("keeps the selection while off, and changing it then needs no reload", () => {
      install(filters(gender(false, ...GENDERS)));
      clickGender("man");
      expect(lastChange().gender).toEqual({
        enabled: false,
        genders: ["woman", "nonbinary", "undefined"],
      });
      expect(applyButton("gender").hidden).toBe(true);
    });

    it("refuses to deselect the last remaining gender", () => {
      install(filters(gender(true, "woman")));
      clickGender("woman");
      expect(activeGenders()).toEqual(["woman"]);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("offers a reload straight away when it differs from what the page loaded with", () => {
      const reloadPage = vi.fn();
      install(filters(gender(true, "woman")), { applied: filters(), reloadPage });
      expect(applyButton("gender").hidden).toBe(false);
      applyButton("gender").click();
      expect(reloadPage).toHaveBeenCalledOnce();
    });
  });
});
