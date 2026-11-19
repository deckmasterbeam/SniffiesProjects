import { describe, expect, it } from "vitest";
import { filterSearchPayload } from "./profile-filter-hook.js";
import {
  createProfileMatcher,
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

const setup = (unlisted: Partial<ProfileFilters["unlisted"]>) => {
  const filters = parseProfileFilters({ unlisted });
  const takeover = statTakeover(() => filters);
  return { takeover, matcher: createProfileMatcher(takeover.rules) };
};

const body = (value: Record<string, unknown>): string =>
  JSON.stringify({ filters: { CRUISER_STATS: { enabled: true, value }, BASIC_FILTERS: {} } });

const shown = (matcher: ReturnType<typeof createProfileMatcher>, ...p: FilterableProfile[]) =>
  filterSearchPayload({ result: { nearbyUsers: p } }, matcher).result?.nearbyUsers?.map(
    (x) => x._id,
  );

describe("statTakeover", () => {
  it("strips a stat only while its switch is on, and drops the emptied CRUISER_STATS", () => {
    const on = setup({ position: true }).takeover.rewriteBody;
    const stripped = JSON.parse(on(body({ "sexuality.attitude": ["top"] })));
    expect(stripped.filters).toEqual({ BASIC_FILTERS: {} });

    const kept = JSON.parse(on(body({ "sexuality.attitude": ["top"], "stats.body": ["slim"] })));
    expect(kept.filters.CRUISER_STATS.value).toEqual({ "stats.body": ["slim"] });

    const off = setup({}).takeover.rewriteBody;
    const original = body({ "sexuality.attitude": ["top"] });
    expect(off(original)).toBe(original);
    expect(on("not json")).toBe("not json");
  });

  it("shows unlisted profiles, hides other values, and goes inactive with no pick", () => {
    const { takeover, matcher } = setup({ position: true });
    const people = [profile("top", "top"), profile("none", null), profile("bottom", "bottom")];
    expect(matcher.isActive()).toBe(false);
    takeover.rewriteBody(body({ "sexuality.attitude": ["top"] }));
    expect(matcher.isActive()).toBe(true);
    expect(shown(matcher, ...people)).toEqual(["top", "none"]);
    takeover.rewriteBody(JSON.stringify({ filters: { BASIC_FILTERS: {} } }));
    expect(matcher.isActive()).toBe(false);
  });

  it("matches endowment length and cut, treating missing fields as unlisted", () => {
    const { takeover, matcher } = setup({ endowment: true });
    takeover.rewriteBody(body({ "stats.endowment": { min: 3, max: 9, cut: "cut" } }));
    expect(
      shown(
        matcher,
        profile("ok", null, { lengthInCm: 18, isCut: true }),
        profile("none", null, null),
        profile("long", null, { lengthInCm: 25, isCut: true }),
        profile("uncut", null, { lengthInCm: 18, isCut: false }),
      ),
    ).toEqual(["ok", "none"]);
  });
});
