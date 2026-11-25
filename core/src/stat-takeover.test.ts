import { filterSearchPayload } from "@core/profile-filter-hook.js";
import {
  createProfileMatcher,
  loadNativePicks,
  parseProfileFilters,
  preferredUnits,
  statTakeover,
  type ProfileFilters,
} from "@core/profile-filter.js";
import type { FilterableProfile, SniffiesPosition } from "@core/sniffies-api.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const profile = (
  id: string,
  attitude: SniffiesPosition | null,
  endowment: { lengthInCm: number | null; isCut: boolean | null } | null = null,
  age: number | null = null,
): FilterableProfile => ({
  _id: id,
  data: { profile: { extended: { sexuality: { attitude }, stats: { endowment, age } } } },
});

const setup = (
  picks: ProfileFilters["picks"] = {},
  unlisted: Partial<ProfileFilters["unlisted"]> = {},
  owns = true,
) => {
  const filters = parseProfileFilters({ unlisted, picks });
  const takeover = statTakeover(
    () => filters,
    () => owns,
  );
  return { takeover, matcher: createProfileMatcher(takeover.rules) };
};

const body = (value: Record<string, unknown>): string =>
  JSON.stringify({ filters: { CRUISER_STATS: { enabled: true, value }, BASIC_FILTERS: {} } });

const shown = (matcher: ReturnType<typeof createProfileMatcher>, ...p: FilterableProfile[]) =>
  filterSearchPayload({ result: { nearbyUsers: p } }, matcher).result?.nearbyUsers?.map(
    (x) => x._id,
  );

describe("statTakeover", () => {
  beforeEach(() => localStorage.clear());

  it("strips every stat of ours from a request while the filters are on, leaving the rest", () => {
    const { takeover } = setup();
    const everything = body({
      "sexuality.attitude": ["top"],
      "stats.body": ["slim"],
      "sexuality.spectrum": ["gay"],
      "stats.endowment": { min: 20 },
    });
    expect(JSON.parse(takeover.rewriteBody(everything)).filters).toEqual({ BASIC_FILTERS: {} });

    const withAge = JSON.parse(
      takeover.rewriteBody(body({ "health.hivStatus": ["negative"], "stats.body": ["slim"] })),
    );
    expect(withAge.filters.CRUISER_STATS.value).toEqual({ "health.hivStatus": ["negative"] });
    expect(takeover.rewriteBody("not json")).toBe("not json");
  });

  it("leaves a request untouched while the filters are off", () => {
    const { takeover } = setup({}, {}, false);
    const original = body({ "sexuality.attitude": ["top"] });
    expect(takeover.rewriteBody(original)).toBe(original);
  });

  it("hides other values, and profiles with none listed unless asked to show them", () => {
    const people = [profile("top", "top"), profile("none", null), profile("bottom", "bottom")];
    expect(setup({ position: ["top"] }).matcher.isActive()).toBe(true);
    expect(shown(setup({ position: ["top"] }).matcher, ...people)).toEqual(["top"]);
    expect(shown(setup({ position: ["top"] }, { position: true }).matcher, ...people)).toEqual([
      "top",
      "none",
    ]);
  });

  it("applies to the map only, not to chat lists", () => {
    const { matcher } = setup({ position: ["top"] });
    const bottom = profile("bottom", "bottom");
    expect(matcher.hidesProfile(bottom)).toBe(true);
    expect(matcher.chat.hidesProfile(bottom)).toBe(false);
  });

  describe("a request with no filters object", () => {
    // The warning is once per page, so each test loads the module afresh.
    const freshRewrite = async (owns: boolean) => {
      vi.resetModules();
      const mod = await import("@core/profile-filter.js");
      return mod.statTakeover(
        () => mod.parseProfileFilters(null),
        () => owns,
      ).rewriteBody;
    };
    const warned = (spy: ReturnType<typeof vi.spyOn>) =>
      spy.mock.calls.filter((call) => String(call.join(" ")).includes("no filters object"));

    it("warns once, since there is nothing to strip our stats from", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const rewrite = await freshRewrite(true);
      rewrite(JSON.stringify({ countryCode: "US" }));
      rewrite(JSON.stringify({ countryCode: "US" }));
      expect(warned(spy)).toHaveLength(1);
      spy.mockRestore();
    });

    it("stays quiet with a filters object, with or without Sniffies' own stats in it", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const rewrite = await freshRewrite(true);
      rewrite(JSON.stringify({ filters: { BASIC_FILTERS: {} } }));
      rewrite(body({ "health.hivStatus": ["negative"] }));
      expect(warned(spy)).toHaveLength(0);
      spy.mockRestore();
    });

    it("stays quiet while the filters are off, when we aren't stripping anything", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const rewrite = await freshRewrite(false);
      rewrite(JSON.stringify({ countryCode: "US" }));
      expect(warned(spy)).toHaveLength(0);
      spy.mockRestore();
    });
  });

  it("is inactive with no pick, or while the filters are off", () => {
    expect(setup().matcher.isActive()).toBe(false);
    expect(setup({ position: [] }, { position: true }).matcher.isActive()).toBe(false);
    expect(setup({ position: ["top"] }, {}, false).matcher.isActive()).toBe(false);
  });

  it("matches endowment length and cut", () => {
    const people = [
      profile("ok", null, { lengthInCm: 18, isCut: true }),
      profile("none", null, null),
      profile("blank", null, { lengthInCm: null, isCut: null }),
      profile("long", null, { lengthInCm: 31, isCut: true }),
      profile("uncut", null, { lengthInCm: 18, isCut: false }),
    ];
    const pick = { endowment: { min: 8, max: 23, cut: "cut" } };
    expect(shown(setup(pick).matcher, ...people)).toEqual(["ok"]);
    expect(shown(setup(pick, { endowment: true }).matcher, ...people)).toEqual([
      "ok",
      "none",
      "blank",
    ]);
  });

  it("matches age, treating the top stop as '90 and up'", () => {
    const people = [
      profile("young", null, null, 22),
      profile("ok", null, null, 30),
      profile("old", null, null, 45),
      profile("ninety", null, null, 90),
      profile("none", null, null, null),
    ];
    expect(shown(setup({ age: { min: 25, max: 40 } }).matcher, ...people)).toEqual(["ok"]);
    expect(shown(setup({ age: { min: 25, max: 40 } }, { age: true }).matcher, ...people)).toEqual([
      "ok",
      "none",
    ]);
    expect(shown(setup({ age: { min: 40, max: 90 } }).matcher, ...people)).toEqual([
      "old",
      "ninety",
    ]);
    expect(setup({ age: {} }).matcher.isActive()).toBe(false);
  });

  it("remembers what Sniffies sent for the stats while the filters are off", () => {
    const { takeover } = setup({}, {}, false);
    takeover.rewriteBody(
      body({
        "sexuality.attitude": ["top"],
        "stats.endowment": { min: 20, max: 30, cut: "cut" },
      }),
    );
    // Sniffies' endowment is in cm; ours is in inches.
    expect(loadNativePicks()).toEqual({
      position: ["top"],
      endowment: { min: 20, max: 30, cut: "cut" },
    });
    takeover.rewriteBody(JSON.stringify({ filters: { BASIC_FILTERS: {} } }));
    expect(loadNativePicks()).toEqual({});
  });

  describe("the saved filters Sniffies restores", () => {
    const saved = () => ({
      user: {
        private: {
          options: {
            filters: {
              USERS: [
                {
                  filterType: "CRUISER_STATS",
                  value: {
                    "stats.endowment": { min: 20, max: 30, cut: "cut" },
                    "sexuality.attitude": ["side"],
                    "health.hivStatus": ["negative"],
                  },
                  enabledValues: {
                    "stats.endowment": true,
                    "sexuality.attitude": false,
                    "health.hivStatus": true,
                  },
                },
              ],
            },
          },
        },
      },
    });
    const enabled = (payload: ReturnType<typeof saved>) =>
      payload.user.private.options.filters.USERS[0]!.enabledValues;

    it("loads our stats as off and keeps Sniffies' own, remembering the ones that were on", () => {
      const { takeover } = setup();
      const out = takeover.disableSavedStats(saved()) as ReturnType<typeof saved>;
      expect(enabled(out)).toEqual({
        "stats.endowment": false,
        "sexuality.attitude": false,
        "health.hivStatus": true,
      });
      // Only a stat that was on counts as a pick to start from.
      expect(loadNativePicks()).toEqual({ endowment: { min: 20, max: 30, cut: "cut" } });
      expect(takeover.disableSavedStats({ user: {} })).toEqual({ user: {} });
    });

    it("only touches keys the saved filters have, not ones inherited from Object.prototype", () => {
      const payload = saved();
      const entry = payload.user.private.options.filters.USERS[0]!;
      // Another hook of ours defines an accessor like this on Object.prototype.
      Object.defineProperty(Object.prototype, "stats.body", {
        configurable: true,
        get: () => undefined,
        set(this: object, value: unknown) {
          Object.defineProperty(this, "stats.body", { value, enumerable: true, writable: true });
        },
      });
      try {
        setup().takeover.disableSavedStats(payload);
        expect(Object.keys(entry.enabledValues)).not.toContain("stats.body");
      } finally {
        delete (Object.prototype as Record<string, unknown>)["stats.body"];
      }
    });

    it("remembers the account's units from the same response, filters on or off", () => {
      const payload = { user: { private: { options: { units: "metric" } } } };
      setup({}, {}, false).takeover.disableSavedStats(payload);
      expect(preferredUnits()).toBe("metric");
    });

    it("leaves them alone while the filters are off", () => {
      const untouched = saved();
      setup({}, {}, false).takeover.disableSavedStats(untouched);
      expect(enabled(untouched)["stats.endowment"]).toBe(true);
      expect(loadNativePicks()).toEqual({});
    });
  });
});
