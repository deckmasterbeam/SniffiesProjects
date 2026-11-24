import { beforeEach, describe, expect, it } from "vitest";
import { filterSearchPayload } from "./profile-filter-hook.js";
import {
  createProfileMatcher,
  loadNativePicks,
  parseProfileFilters,
  statTakeover,
  type ProfileFilters,
} from "./profile-filter.js";
import type { FilterableProfile } from "./sniffies-api.js";

const profile = (
  id: string,
  attitude: string | null,
  endowment: { lengthInCm: number | null; isCut: boolean | null } | null = null,
): FilterableProfile => ({
  _id: id,
  data: { profile: { extended: { sexuality: { attitude }, stats: { endowment } } } },
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

  it("strips all four stats from a request while the filters are on, leaving the rest", () => {
    const { takeover } = setup();
    const everything = body({
      "sexuality.attitude": ["top"],
      "stats.body": ["slim"],
      "sexuality.spectrum": ["gay"],
      "stats.endowment": { min: 20 },
    });
    expect(JSON.parse(takeover.rewriteBody(everything)).filters).toEqual({ BASIC_FILTERS: {} });

    const withAge = JSON.parse(
      takeover.rewriteBody(body({ "stats.age": { min: 18, max: 29 }, "stats.body": ["slim"] })),
    );
    expect(withAge.filters.CRUISER_STATS.value).toEqual({ "stats.age": { min: 18, max: 29 } });
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
    const pick = { endowment: { min: 3, max: 9, cut: "cut" } };
    expect(shown(setup(pick).matcher, ...people)).toEqual(["ok"]);
    expect(shown(setup(pick, { endowment: true }).matcher, ...people)).toEqual([
      "ok",
      "none",
      "blank",
    ]);
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
      endowment: { min: 8, max: 12, cut: "cut" },
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
                    "stats.age": { min: 18, max: 29 },
                  },
                  enabledValues: {
                    "stats.endowment": true,
                    "sexuality.attitude": false,
                    "stats.age": true,
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
        "stats.age": true,
      });
      // Only a stat that was on counts as a pick to start from.
      expect(loadNativePicks()).toEqual({ endowment: { min: 8, max: 12, cut: "cut" } });
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

    it("leaves them alone while the filters are off", () => {
      const untouched = saved();
      setup({}, {}, false).takeover.disableSavedStats(untouched);
      expect(enabled(untouched)["stats.endowment"]).toBe(true);
      expect(loadNativePicks()).toEqual({});
    });
  });
});
