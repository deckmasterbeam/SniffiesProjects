import { describe, expect, it, vi } from "vitest";
import {
  filters,
  range,
  row,
  applyButton,
  statCheckbox,
  statValue,
  isChecked,
  openSheet,
  sheet,
  wheelLabels,
  pick,
  picked,
  sheetButton,
  useMenu,
} from "./test-kit.js";
import { saveUnits } from "../profile-filter.js";
import { STRINGS } from "../strings.js";

describe("installProfileFiltersMenu", () => {
  const { install, onChange, lastChange } = useMenu();

  describe("height and weight lines", () => {
    it("look like an unset Sniffies stat line until a range is picked", () => {
      install(filters());
      expect(statValue("height")).toBe(STRINGS.filterMenu.select);
      expect(row("height").querySelector("button")!.className).toBe("select");
      expect(row("height").querySelector(".text-value")!.classList).toContain("placeholder");
      expect(isChecked("height")).toBe(false);
      expect(row("height").querySelector(".list-item")!.classList).toContain("parent-enabled");
    });

    it("aren't hidden along with the Endowment line they're cloned from", () => {
      install(filters());
      expect(row("height").classList.contains("snp-native-hidden")).toBe(false);
      expect(row("weight").classList.contains("snp-native-hidden")).toBe(false);
    });

    describe("Cruiser Stats off", () => {
      const nativeLine = (): Element => document.querySelector(".smart-options-container")!;
      const cruiserStats = async (on: boolean): Promise<void> => {
        nativeLine().classList.toggle("active", on);
        await Promise.resolve(); // MutationObserver callbacks run as a microtask
      };

      it("greys the lines out and switches the filters off, keeping the ranges", async () => {
        install(filters({ height: range({ min: 178, max: 191 }) }));
        await cruiserStats(false);
        expect(row("height").querySelector(".list-item")!.classList).not.toContain(
          "parent-enabled",
        );
        expect(lastChange().height).toEqual(range({ enabled: false, min: 178, max: 191 }));
        expect(isChecked("height")).toBe(false);
        expect(statValue("height")).toBe(`5'10" - 6'3"`);
      });

      it("turns the filters back on when it comes back on", async () => {
        install(filters({ height: range({ min: 178, max: 191 }) }));
        await cruiserStats(false);
        await cruiserStats(true);
        expect(lastChange().height.enabled).toBe(true);
        expect(isChecked("height")).toBe(true);
      });

      it("leaves a filter that was already off alone", async () => {
        install(filters({ height: range({ enabled: false, min: 178, max: 191 }) }));
        await cruiserStats(false);
        await cruiserStats(true);
        expect(onChange).not.toHaveBeenCalled();
      });

      it("ignores clicks on the checkbox and the value button", async () => {
        install(filters({ weight: range({ min: 68, max: 79 }) }));
        await cruiserStats(false);
        onChange.mockClear();
        statCheckbox("weight").click();
        openSheet("weight");
        expect(sheet()).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
      });
    });

    it("show the range and a ticked checkbox once set", () => {
      install(
        filters({
          height: range({ min: 178, max: 191 }),
          weight: range({ min: null, max: 80 }),
        }),
      );
      expect(statValue("height")).toBe(`5'10" - 6'3"`);
      expect(row("height").querySelector("button")!.className).toBe("range");
      expect(row("height").querySelector(".text-value")!.classList).not.toContain("placeholder");
      expect(isChecked("height")).toBe(true);
      expect(statCheckbox("height").classList).toContain("active");
      expect(row("height").querySelector(".stat-button")!.classList).toContain("active");
      expect(statValue("weight")).toBe(STRINGS.range.upTo("175lb"));
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
    it("opens from the line with Cancel / title / Done and min and max wheels", () => {
      install(filters());
      openSheet("height");
      expect(sheet()!.querySelector("h1")!.textContent).toBe(STRINGS.filterMenu.height);
      expect(sheet()!.getAttribute("aria-label")).toBe(
        STRINGS.range.makeASelection(STRINGS.filterMenu.height),
      );
      expect([...sheet()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
        STRINGS.range.cancel,
        STRINGS.range.done,
      ]);
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
      sheetButton(STRINGS.range.cancel).click();

      openSheet("weight");
      const weights = wheelLabels("max");
      expect(weights.slice(0, 3)).toEqual(["-", "90lb", "95lb"]);
      expect(weights.at(-1)).toBe("400lb");
      expect(weights).toHaveLength(1 + 63);
    });

    it("follows the account's units, with no unit wheel to choose from", () => {
      install(filters());
      openSheet("height");
      expect(wheelLabels("unit")).toEqual([]);
      expect(wheelLabels("min")[1]).toBe(`4'0"`);
      sheetButton(STRINGS.range.cancel).click();
    });

    it("offers metric ranges when the account is metric: height in 1cm steps, weight in 5kg steps", () => {
      saveUnits("metric");
      install(filters());
      openSheet("height");
      expect(wheelLabels("min").slice(1, 3)).toEqual(["120cm", "121cm"]);
      expect(wheelLabels("min").at(-1)).toBe("210cm +");
      sheetButton(STRINGS.range.cancel).click();

      openSheet("weight");
      expect(wheelLabels("min").slice(1, 3)).toEqual(["40kg", "45kg"]);
      expect(wheelLabels("min").at(-1)).toBe("180kg +");
    });

    it("Done stores the range in Sniffies' units, switches the filter on and closes", () => {
      install(filters());
      openSheet("height");
      pick("min", `5'10"`);
      pick("max", `6'3"`);
      sheetButton(STRINGS.range.done).click();
      expect(sheet()).toBeNull();
      expect(lastChange().height).toEqual(range({ min: 178, max: 191 }));
      expect(statValue("height")).toBe(`5'10" - 6'3"`);
      expect(isChecked("height")).toBe(true);
      expect(applyButton("height").hidden).toBe(false);

      openSheet("weight");
      pick("min", "150lb");
      pick("max", "175lb");
      sheetButton(STRINGS.range.done).click();
      expect(lastChange().weight).toEqual(range({ min: 68, max: 79 }));
    });

    it("has an include-unspecified checkbox, off by default, saved with Done", () => {
      install(filters({ height: range({ min: 178 }) }));
      openSheet("height");
      const checkbox = sheet()!.querySelector<HTMLInputElement>(".snp-flyout-option input")!;
      expect(sheet()!.querySelector(".snp-flyout-option")!.textContent).toBe(
        STRINGS.range.includeUnlisted("height"),
      );
      expect(checkbox.checked).toBe(false);
      checkbox.click();
      sheetButton(STRINGS.range.done).click();
      expect(lastChange().height).toEqual(range({ min: 178, includeUnspecified: true }));
      // It changes who is shown, so it needs a reload like any other change.
      expect(applyButton("height").hidden).toBe(false);

      openSheet("height");
      expect(sheet()!.querySelector<HTMLInputElement>(".snp-flyout-option input")!.checked).toBe(
        true,
      );
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
        () => sheetButton(STRINGS.range.cancel).click(),
        () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
        () => document.querySelector<HTMLElement>(".snp-flyout-backdrop")!.click(),
      ]) {
        openSheet("height");
        pick("min", `5'10"`);
        dismiss();
        expect(sheet()).toBeNull();
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(statValue("height")).toBe(STRINGS.filterMenu.select);
    });

    it("Done with both ends left open switches the filter off", () => {
      install(filters({ height: range({ min: 178 }) }));
      openSheet("height");
      pick("min", "-");
      sheetButton(STRINGS.range.done).click();
      expect(lastChange().height).toEqual(range({ enabled: false }));
      expect(statValue("height")).toBe(STRINGS.filterMenu.select);
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
      sheetButton(STRINGS.range.done).click();
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

    it("a saved range snaps to the account's metric choices", () => {
      saveUnits("metric");
      install(filters({ weight: range({ min: 68 }) }));
      expect(statValue("weight")).toBe("70kg +");
      openSheet("weight");
      expect(picked("min")).toBe("70kg");
      sheetButton(STRINGS.range.done).click();
      expect(lastChange().weight).toEqual(range({ min: 70 }));
    });

    it("mounts where Sniffies puts its own sheets: as a child of the stats filter", () => {
      install(filters());
      openSheet("height");
      const mounted = document.getElementById("snp-range-flyout")!;
      expect(mounted.parentElement).toBe(document.querySelector("smart-select-filter"));
      sheetButton(STRINGS.range.cancel).click();
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
