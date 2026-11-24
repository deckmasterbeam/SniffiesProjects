import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MENU_HTML,
  filters,
  gender,
  range,
  row,
  applyButton,
  genderToggle,
  activeGenders,
  clickGender,
  statValue,
  isChecked,
  openSheet,
  pick,
  sheetButton,
  useMenu,
} from "./test-kit.js";
import { STRINGS } from "../strings.js";
import { type Gender } from "../profile-filter.js";

describe("installProfileFiltersMenu", () => {
  const { install, uninstall, onChange } = useMenu();

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
        "Endowment",
        STRINGS.filterMenu.height,
        STRINGS.filterMenu.weight,
        "Sexuality",
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
      sheetButton(STRINGS.range.done).click();
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

  describe("markup warnings", () => {
    afterEach(() => vi.useRealTimers());

    it("warns once when only one of Profile Type / Cruising Now stays in the menu", async () => {
      vi.resetModules();
      const { installProfileFiltersMenu: freshInstall } = await import("./menu.js");
      vi.useFakeTimers();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      document.querySelector("ui-list-item-level-2")!.remove();
      const off = freshInstall({ initial: filters(), applied: filters(), onChange });
      document.body.append(document.createElement("div")); // any mutation
      await vi.advanceTimersByTimeAsync(0);
      expect(warnSpy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2500);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]!.join(" ")).toContain("Profile Type but not Cruising Now");
      off();
      warnSpy.mockRestore();
    });

    it("stays quiet when the menu isn't open at all", async () => {
      vi.resetModules();
      const { installProfileFiltersMenu: freshInstall } = await import("./menu.js");
      vi.useFakeTimers();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      document.body.innerHTML = "";
      const off = freshInstall({ initial: filters(), applied: filters(), onChange });
      document.body.append(document.createElement("div"));
      await vi.advanceTimersByTimeAsync(5000);
      expect(warnSpy).not.toHaveBeenCalled();
      off();
      warnSpy.mockRestore();
    });
  });
});
