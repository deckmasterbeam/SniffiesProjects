import { afterEach, describe, expect, it, vi } from "vitest";
import { onlineSinceLabel } from "../profile-filter.js";
import { STRINGS } from "../strings.js";
import {
  applyButton,
  filters,
  onlineAfter,
  pick,
  row,
  sheet,
  sheetButton,
  useMenu,
  wheelLabels,
} from "./test-kit.js";

describe("installProfileFiltersMenu", () => {
  const { install, onChange, lastChange } = useMenu();

  describe("last online", () => {
    // 3:00PM local, so a 3 hour pick reads "after 12:00PM".
    const freezeAt3pm = (): void => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 9, 20, 15, 0));
    };
    afterEach(() => vi.useRealTimers());
    const toggle = (): HTMLInputElement =>
      document.querySelector<HTMLInputElement>("#snp-online-filter-enabled")!;
    const switchShown = (): boolean => toggle().closest("label")!.style.display === "";
    const since = (): HTMLElement => row("online").querySelector<HTMLElement>(".snp-online-since")!;
    const sinceShown = (): boolean => since().style.display !== "none";
    const title = (): string => row("online").querySelector("p")!.textContent!.trim();
    const openSheet = (): void => row("online").querySelector("label")!.click();

    it("mounts right under Cruising Now, leaving its own switch alone", () => {
      install(filters());
      const cruising = document.querySelector("ui-list-item-level-2")!;
      expect(cruising.nextElementSibling).toBe(row("online"));
      expect(document.querySelectorAll("#CONNECTED_NOW")).toHaveLength(1);
      expect(row("online").querySelector("label")?.hasAttribute("for")).toBe(false);
      expect(row("online").querySelector("[data-testid]")).toBeNull();
    });

    it("off and empty: Online After with its switch off and no cutoff line", () => {
      install(filters());
      expect(title()).toBe(STRINGS.filterMenu.onlineAfter);
      expect(toggle().checked).toBe(false);
      expect(toggle().disabled).toBe(false);
      expect(switchShown()).toBe(true);
      expect(sinceShown()).toBe(false);
      expect(applyButton("online").hidden).toBe(true);
    });

    it("clicking the switch with nothing picked opens the sheet instead of turning on", () => {
      install(filters());
      toggle().click();
      expect(sheet()).not.toBeNull();
      expect(toggle().checked).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("Static mode: options show the time they work out to, and Done fixes the cutoff", () => {
      freezeAt3pm();
      install(filters());
      openSheet();
      sheetButton(STRINGS.filterMenu.static).click();
      expect(wheelLabels("choice")[0]).toMatch(/^< 15 min ago \(2:45(PM)?\)$/);
      pick("choice", wheelLabels("choice")[5]!);
      sheetButton(STRINGS.range.done).click();
      expect(lastChange().online).toEqual({
        enabled: true,
        minutes: 180,
        pickedAt: Date.now(),
        cutoff: Date.now() - 180 * 60_000,
      });
      expect(since().textContent).toMatch(onlineAfter("12:00"));
    });

    it("offers 15 min to 48 hours in a scrolling sheet", () => {
      install(filters());
      openSheet();
      expect(wheelLabels("choice")).toEqual([
        "< 15 min ago",
        "< 30 min ago",
        "< 45 min ago",
        "< 1 hour ago",
        "< 1.5 hours ago",
        "< 3 hours ago",
        "< 6 hours ago",
        "< 12 hours ago",
        "< 24 hours ago",
        "< 36 hours ago",
        "< 48 hours ago",
      ]);
    });

    it("picking: Reload to apply replaces the switch and the cutoff shows below", () => {
      freezeAt3pm();
      install(filters());
      openSheet();
      pick("choice", "< 3 hours ago");
      expect(onChange).not.toHaveBeenCalled();
      sheetButton(STRINGS.range.done).click();
      expect(lastChange().online).toEqual({ enabled: true, minutes: 180, pickedAt: Date.now() });
      expect(switchShown()).toBe(false);
      expect(applyButton("online").hidden).toBe(false);
      expect(applyButton("online").parentElement).toBe(row("online").querySelector(".trailing"));
      expect(since().textContent).toBe(onlineSinceLabel(180, Date.now()));
      expect(since().textContent).toMatch(onlineAfter("12:00"));
    });

    it("applied and on: the switch is back, on, with the cutoff from page load", () => {
      install(filters({ online: { enabled: true, minutes: 60 } }));
      expect(switchShown()).toBe(true);
      expect(toggle().checked).toBe(true);
      expect(applyButton("online").hidden).toBe(true);
      expect(sinceShown()).toBe(true);
      expect(since().textContent).toMatch(onlineAfter(""));
    });

    it("switching it off: Reload to apply replaces the switch and the cutoff goes", () => {
      install(filters({ online: { enabled: true, minutes: 60 } }));
      toggle().click();
      expect(lastChange().online).toEqual({ enabled: false, minutes: 60 });
      expect(switchShown()).toBe(false);
      expect(applyButton("online").hidden).toBe(false);
      expect(sinceShown()).toBe(false);
    });

    it("switching it back on before reloading puts the switch back", () => {
      install(filters({ online: { enabled: true, minutes: 60 } }));
      toggle().click();
      toggle().click();
      expect(lastChange().online).toEqual({ enabled: true, minutes: 60 });
      expect(switchShown()).toBe(true);
      expect(applyButton("online").hidden).toBe(true);
    });

    it("Done re-anchors the time even when the same option is confirmed again", () => {
      freezeAt3pm();
      install(filters({ online: { enabled: true, minutes: 180 } }));
      expect(applyButton("online").hidden).toBe(true);
      vi.setSystemTime(new Date(2026, 9, 20, 15, 30));
      openSheet();
      pick("choice", "< 3 hours ago");
      sheetButton(STRINGS.range.done).click();
      expect(since().textContent).toBe(onlineSinceLabel(180, Date.now()));
      expect(since().textContent).toMatch(onlineAfter("12:30"));
      expect(applyButton("online").hidden).toBe(false);
    });

    it("Cancel leaves the filter alone", () => {
      install(filters());
      openSheet();
      pick("choice", "< 3 hours ago");
      sheetButton(STRINGS.range.cancel).click();
      expect(onChange).not.toHaveBeenCalled();
      expect(sinceShown()).toBe(false);
    });
  });
});
