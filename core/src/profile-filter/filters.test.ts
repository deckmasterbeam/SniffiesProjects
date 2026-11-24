import { beforeEach, describe, expect, it } from "vitest";
import { STRINGS } from "../strings.js";
import { DEFAULT_PROFILE_FILTERS, gateProfileFilters, parseProfileFilters } from "./filters.js";
import { loadFiltersMirror, saveFiltersMirror } from "./filters.js";
import { hasStatPick, ownsAnyStat, statKey, statPickLabel } from "./stat-picks.js";

describe("profile filters", () => {
  beforeEach(() => localStorage.clear());

  describe("picks", () => {
    it("keeps valid picks, drops garbage, and keeps a cleared (empty) pick", () => {
      const parsed = parseProfileFilters({
        picks: {
          position: ["top", 5, "vers"],
          bodyType: [],
          sexuality: "gay",
          endowment: { min: 3, max: "x", cut: "cut", extra: 1 },
        },
      });
      expect(parsed.picks).toEqual({
        position: ["top", "vers"],
        bodyType: [],
        endowment: { min: 3, cut: "cut" },
      });
      expect(parseProfileFilters(null).picks).toEqual({});
    });

    it("counts only a non-empty pick as one", () => {
      expect(hasStatPick("position", undefined)).toBe(false);
      expect(hasStatPick("position", [])).toBe(false);
      expect(hasStatPick("position", ["top"])).toBe(true);
      expect(hasStatPick("endowment", {})).toBe(false);
      expect(hasStatPick("endowment", { cut: "cut" })).toBe(true);
      expect(hasStatPick("endowment", { max: 9 })).toBe(true);
    });

    it("is dropped, with the none-listed switches, while the filters are off", () => {
      const filters = parseProfileFilters({
        picks: { position: ["top"] },
        unlisted: { position: true },
      });
      expect(gateProfileFilters(filters, true)).toBe(filters);
      const off = gateProfileFilters(filters, false);
      expect(off.picks).toEqual({});
      expect(off.unlisted).toEqual(DEFAULT_PROFILE_FILTERS.unlisted);
    });
  });

  describe("what a stat filters for", () => {
    it("keys on the pick and none listed together, and is empty with no pick", () => {
      const key = (picks: object, unlisted: object = {}) =>
        statKey(parseProfileFilters({ picks, unlisted }), "position");
      expect(key({})).toBe("");
      expect(key({ position: [] }, { position: true })).toBe("");
      expect(key({ position: ["top"] })).not.toBe("");
      expect(key({ position: ["top"] })).not.toBe(key({ position: ["top"] }, { position: true }));
      expect(key({ position: ["top"] })).not.toBe(key({ position: ["bottom"] }));
    });

    it("says whether any stat is ours and filtering", () => {
      expect(ownsAnyStat(parseProfileFilters(null))).toBe(false);
      expect(ownsAnyStat(parseProfileFilters({ picks: { bodyType: [] } }))).toBe(false);
      expect(ownsAnyStat(parseProfileFilters({ picks: { bodyType: ["slim"] } }))).toBe(true);
    });

    it("labels the picks the way the row reads them", () => {
      expect(statPickLabel("position", ["top", "bottom-sub"])).toBe("Top, Submissive bottom");
      expect(statPickLabel("endowment", { min: 8, max: 12, cut: "cut" })).toBe('8" - 12", cut');
      expect(statPickLabel("endowment", { min: 8 })).toBe('8" +');
      expect(statPickLabel("endowment", { max: 5, cut: "uncut" })).toBe(
        `${STRINGS.range.upTo('5"')}, uncut`,
      );
      // A value it has no label for reads as itself, rather than disappearing.
      expect(statPickLabel("sexuality", ["something-new"])).toBe("something-new");
    });
  });

  describe("the copy the page hook starts from", () => {
    it("round-trips the filters and whether they are on", () => {
      const filters = parseProfileFilters({
        picks: { endowment: { min: 8, max: 12, cut: "cut" } },
        unlisted: { endowment: true },
      });
      saveFiltersMirror(filters, true);
      expect(loadFiltersMirror()).toEqual({ enabled: true, filters });
    });

    it("is off, with default filters, when nothing was saved or it is unreadable", () => {
      const fresh = { enabled: false, filters: parseProfileFilters(null) };
      expect(loadFiltersMirror()).toEqual(fresh);
      localStorage.setItem("snp-applied-profile-filters", "{not json");
      expect(loadFiltersMirror()).toEqual(fresh);
      localStorage.setItem("snp-applied-profile-filters", JSON.stringify({ enabled: "yes" }));
      expect(loadFiltersMirror()).toEqual(fresh);
    });
  });
});
