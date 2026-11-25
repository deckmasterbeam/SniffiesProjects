import { describe, expect, it, vi } from "vitest";
import { parseProfileFilters, saveUnits, type ProfileFilters } from "../profile-filter.js";
import { STRINGS } from "../strings.js";
import {
  filters,
  isChecked,
  openSheet,
  pick,
  row,
  sheet,
  sheetButton,
  statCheckbox,
  statValue,
  useMenu,
  wheelItems,
  wheelLabels,
} from "./test-kit.js";

describe("installProfileFiltersMenu", () => {
  const { install, lastChange } = useMenu();

  describe("Position / Body Type / Sexuality / Endowment", () => {
    const withPicks = (
      picks: ProfileFilters["picks"],
      unlisted: Partial<ProfileFilters["unlisted"]> = {},
    ) => filters({ picks, unlisted: { ...parseProfileFilters(null).unlisted, ...unlisted } });
    const nativeLine = (key: string): Element =>
      document.querySelector(`label[for="${key}"]`)!.closest("ui-menu-item-group")!;

    it("always replaces Sniffies' row with ours, showing Select until something is picked", () => {
      install(filters());
      expect(nativeLine("stats.endowment").classList.contains("snp-native-hidden")).toBe(true);
      expect(nativeLine("sexuality.spectrum").classList.contains("snp-native-hidden")).toBe(true);
      expect(row("endowment").style.display).not.toBe("none");
      expect(isChecked("sexuality")).toBe(false);
      expect(statValue("sexuality")).toBe(STRINGS.filterMenu.select);
    });

    it("shows the picks, and none listed when it is on", () => {
      install(
        withPicks(
          { sexuality: ["gay", "bi"], endowment: { min: 3, max: 9, cut: "cut" } },
          { endowment: true },
        ),
      );
      expect(isChecked("sexuality")).toBe(true);
      expect(statValue("sexuality")).toBe("Bi, Gay".split(", ").reverse().join(", "));
      expect(statValue("endowment")).toBe(`1" - 3.5", cut, ${STRINGS.filterMenu.noneListed}`);
    });

    it("forces the native row off so Sniffies' own check never sees the stat", () => {
      install(filters());
      const native = document.querySelector<HTMLElement>('label[for="sexuality.spectrum"]')!;
      native.classList.add("active");
      const click = vi.spyOn(native, "click");
      document.body.appendChild(document.createElement("span"));
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          expect(click).toHaveBeenCalledTimes(1);
          resolve();
        }, 0),
      );
    });

    describe("Sniffies' own Cruiser Stats switch, which it turns off once its stats are", () => {
      const withMaster = (): HTMLInputElement => {
        // Sniffies has already switched Cruiser Stats off: its stats are all off.
        document.querySelector(".smart-options-container")!.classList.remove("active");
        document.body.insertAdjacentHTML(
          "afterbegin",
          '<label class="switch"><input disabled type="checkbox" id="CRUISER_STATS" /></label>',
        );
        return document.querySelector<HTMLInputElement>("input#CRUISER_STATS")!;
      };

      it("shows it on while one of our stats is filtering, and puts it back after", () => {
        const master = withMaster();
        install(withPicks({ endowment: { min: 20, max: 30 } }));
        expect(master.checked).toBe(true);
        statCheckbox("endowment").click();
        expect(master.checked).toBe(false);
      });

      it("leaves it alone when none of our stats is filtering", () => {
        const master = withMaster();
        install(filters());
        expect(master.checked).toBe(false);
      });

      it("doesn't stop our row, or Height and Weight, working", () => {
        withMaster();
        install(withPicks({ endowment: { min: 20, max: 30 } }));
        expect(row("endowment").querySelector(".list-item")!.classList).toContain("parent-enabled");
        expect(row("height").querySelector(".list-item")!.classList).toContain("parent-enabled");
      });
    });

    it("clears the pick when its checkbox is clicked, keeping none listed as it was", () => {
      install(withPicks({ sexuality: ["gay"] }, { sexuality: true }));
      statCheckbox("sexuality").click();
      expect(lastChange().picks.sexuality).toEqual([]);
      expect(lastChange().unlisted.sexuality).toBe(true);
      expect(isChecked("sexuality")).toBe(false);
      expect(statValue("sexuality")).toBe(STRINGS.filterMenu.select);
    });

    it("opens the sheet instead when the checkbox is clicked with nothing picked", () => {
      install(filters());
      statCheckbox("sexuality").click();
      expect(sheet()).not.toBeNull();
    });

    describe("pick sheet", () => {
      it("is a wheel with a '-' on top and the options below, like Sniffies' own", () => {
        install(filters());
        openSheet("sexuality");
        expect(wheelLabels("multi")).toEqual([
          "-",
          "Straight",
          "Straight-curious",
          "Bicurious",
          "Bi",
          "Gay",
        ]);
        expect(sheet()!.querySelector(".snp-flyout-prompt")!.textContent).toContain(
          STRINGS.range.chooseSeveral,
        );
      });

      it("saves the checked options, with the picks listed in the prompt", () => {
        install(withPicks({ sexuality: ["gay"] }));
        openSheet("sexuality");
        pick("multi", "Straight");
        expect(sheet()!.querySelector(".snp-flyout-bold")!.textContent).toBe("Straight, Gay");
        sheetButton(STRINGS.range.done).click();
        expect(lastChange().picks.sexuality).toEqual(["straight", "gay"]);
      });

      it("un-checks an option when it's picked again, and '-' clears them all", () => {
        install(withPicks({ sexuality: ["gay", "bi"] }));
        openSheet("sexuality");
        pick("multi", "Gay");
        expect(
          wheelItems("multi")
            .filter((item) => item.classList.contains("checked"))
            .map((item) => item.textContent),
        ).toEqual(["Bi"]);
        pick("multi", "-");
        sheetButton(STRINGS.range.done).click();
        expect(lastChange().picks.sexuality).toEqual([]);
      });

      it("has the none-listed switch, saved with Done", () => {
        install(withPicks({ sexuality: ["gay"] }));
        openSheet("sexuality");
        const unlisted = sheet()!.querySelector<HTMLInputElement>(".snp-flyout-option input")!;
        expect(unlisted.checked).toBe(false);
        unlisted.checked = true;
        unlisted.dispatchEvent(new Event("change"));
        sheetButton(STRINGS.range.done).click();
        expect(lastChange().unlisted.sexuality).toBe(true);
        expect(lastChange().picks.sexuality).toEqual(["gay"]);
        expect(statValue("sexuality")).toBe(`Gay, ${STRINGS.filterMenu.noneListed}`);
      });

      it("saves an endowment range and cut", () => {
        install(filters());
        openSheet("endowment");
        expect(wheelLabels("min")[1]).toBe('1"');
        pick("min", '1"');
        pick("max", '3.5"');
        pick("column", "Cut");
        sheetButton(STRINGS.range.done).click();
        expect(lastChange().picks.endowment).toEqual({ min: 3, max: 9, cut: "cut" });
      });

      it("offers centimetres when the account is metric", () => {
        saveUnits("metric");
        install(withPicks({ endowment: { min: 12, max: 18 } }));
        expect(statValue("endowment")).toBe("12cm - 18cm");
        openSheet("endowment");
        expect(wheelLabels("min").slice(1, 3)).toEqual(["2cm", "3cm"]);
        expect(wheelLabels("min").at(-1)).toBe("30cm +");
        expect(wheelLabels("unit")).toEqual([]);
        pick("min", "10cm");
        pick("max", "20cm");
        sheetButton(STRINGS.range.done).click();
        expect(lastChange().picks.endowment).toEqual({ min: 10, max: 20 });
      });
    });

    describe("starting from what Sniffies had saved", () => {
      it("takes it once, then leaves the row alone after it's cleared", () => {
        localStorage.setItem("snp-native-stat-picks", JSON.stringify({ sexuality: ["bi"] }));
        install(filters());
        expect(lastChange().picks.sexuality).toEqual(["bi"]);
        expect(statValue("sexuality")).toBe("Bi");
        expect(localStorage.getItem("snp-native-stat-picks")).toBe("{}");
        statCheckbox("sexuality").click();
        expect(lastChange().picks.sexuality).toEqual([]);
      });

      it("doesn't take it over picks the user already has", () => {
        localStorage.setItem("snp-native-stat-picks", JSON.stringify({ sexuality: ["bi"] }));
        install(withPicks({ sexuality: ["gay"] }));
        expect(statValue("sexuality")).toBe("Gay");
      });
    });
  });
});
