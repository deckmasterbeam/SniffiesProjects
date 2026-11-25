import { expect, type BrowserContext, type Page } from "@playwright/test";
import { SNIFFIES_ORIGIN } from "./constants.js";
import { mockApi, sendXhr } from "./sniffies-api.js";

/**
 * Shared by the extension and userscript specs: Age / Position / Body Type / Sexuality / Endowment
 * are ours while the profile filters are on, so Sniffies' own network traffic has to be rewritten
 * the same way in both.
 */

/** Age and endowment ranges (8"–12", cut), with profiles that list none included. */
export const OWNED_FILTERS = {
  unlisted: { age: true, endowment: true },
  picks: { age: { min: 18, max: 29 }, endowment: { min: 20, max: 30, cut: "cut" } },
};

const MATCH = {
  _id: "match",
  data: {
    profile: { extended: { stats: { age: 25, endowment: { lengthInCm: 25, isCut: true } } } },
  },
};
const NONE_LISTED = {
  _id: "noneListed",
  data: { profile: { extended: { stats: { endowment: { lengthInCm: null, isCut: null } } } } },
};
const TOO_SMALL = {
  _id: "tooSmall",
  data: {
    profile: { extended: { stats: { age: 25, endowment: { lengthInCm: 10, isCut: true } } } },
  },
};

/** What Sniffies' server sends back, per path. The map holds one profile of each kind. */
const RESPONSES: Record<string, unknown> = {
  "/api/post-authentication": {
    nearbyVisitors: { visitors: [MATCH, NONE_LISTED, TOO_SMALL] },
  },
  // Its saved filters, as restored on login: Endowment 20–30 cm, cut, on.
  "/api/authenticate/current": {
    user: {
      private: {
        options: {
          filters: {
            USERS: [
              {
                filterType: "CRUISER_STATS",
                value: {
                  "stats.age": { min: 18, max: 29 },
                  "health.hivStatus": ["negative"],
                  "stats.endowment": { min: 20, max: 30, cut: "cut" },
                },
                enabledValues: {
                  "stats.age": true,
                  "health.hivStatus": true,
                  "stats.endowment": true,
                },
                enabled: true,
              },
            ],
          },
        },
      },
    },
  },
};

/** Answers Sniffies' API paths and records the bodies the page sent. */
export const mockSniffiesApi = (context: BrowserContext) => mockApi(context, RESPONSES);

const post = (page: Page, path: string, body: unknown): Promise<string> =>
  sendXhr(page, "POST", `${SNIFFIES_ORIGIN}${path}`, body);

const filtersRequest = (value: Record<string, unknown>) => ({
  filters: {
    CRUISER_STATS: { filterType: "CRUISER_STATS", enabled: true, value, assignmentType: "EQ" },
    BASIC_FILTERS: {},
  },
});

/** The map request leaves without our stats, so Sniffies' server doesn't filter on them. */
export const expectRequestStripped = async (page: Page, posted: Record<string, string[]>) => {
  await post(
    page,
    "/api/post-authentication",
    filtersRequest({
      "stats.age": { min: 18, max: 29 },
      "health.hivStatus": ["negative"],
      "stats.endowment": { min: 20, max: 30 },
    }),
  );
  const body = JSON.parse(posted["/api/post-authentication"]!.at(-1)!);
  // Its own stats still go through.
  expect(body.filters.CRUISER_STATS.value).toEqual({ "health.hivStatus": ["negative"] });
};

/** Sniffies restores the stat as off, so its own map check never sees it. */
export const expectSavedFiltersLoadedDisabled = async (page: Page) => {
  const response = JSON.parse(await post(page, "/api/authenticate/current", {}));
  const [entry] = response.user.private.options.filters.USERS;
  expect(entry.enabledValues).toEqual({
    "stats.age": false,
    "health.hivStatus": true,
    "stats.endowment": false,
  });
  // The pick itself is left in place.
  expect(entry.value["stats.endowment"]).toEqual({ min: 20, max: 30, cut: "cut" });
};

/** The profile with no endowment listed is kept, and the one outside the range still isn't. */
export const expectNoneListedKept = async (page: Page) => {
  const response = JSON.parse(await post(page, "/api/post-authentication", {}));
  const ids = response.nearbyVisitors.visitors.map((visitor: { _id: string }) => visitor._id);
  expect(ids).toEqual(["match", "noneListed"]);
};

/** The same map with none listed off: only profiles that list a match stay. */
export const expectNoneListedHidden = async (page: Page) => {
  const response = JSON.parse(await post(page, "/api/post-authentication", {}));
  const ids = response.nearbyVisitors.visitors.map((visitor: { _id: string }) => visitor._id);
  expect(ids).toEqual(["match"]);
};
