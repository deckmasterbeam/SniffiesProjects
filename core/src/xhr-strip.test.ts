import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installProfileFilterHook } from "./profile-filter-hook.js";
import { parseProfileFilters, statTakeover, type ProfileFilters } from "./profile-filter.js";

// Records what reaches the "network": the body the page's own code sent, after our patches.
const sent: unknown[] = [];
// A new class each time: the hook marks the prototype it patched, so reusing one would skip the
// install in every test after the first.
const makeFakeXhr = (): typeof XMLHttpRequest => {
  class FakeXhr {
    responseType = "";
    private text = "";
    get responseText(): string {
      return this.text;
    }
    get response(): string {
      return this.text;
    }
    __setRawResponse(text: string): void {
      this.text = text;
    }
    open(): void {}
    send(body?: unknown): void {
      sent.push(body);
    }
  }
  return FakeXhr as unknown as typeof XMLHttpRequest;
};

type Fake = XMLHttpRequest & { __setRawResponse: (text: string) => void };

const API = "https://uswapi.sniffies.com";
const filtersBody = (value: Record<string, unknown>): string =>
  JSON.stringify({
    filters: {
      CRUISER_STATS: { filterType: "CRUISER_STATS", enabled: true, value, assignmentType: "EQ" },
      BASIC_FILTERS: {},
    },
  });

describe("the stat takeover through real XHR sends", () => {
  let original: typeof XMLHttpRequest;
  beforeEach(() => {
    original = window.XMLHttpRequest;
    window.XMLHttpRequest = makeFakeXhr();
    sent.length = 0;
    localStorage.clear();
  });
  afterEach(() => {
    window.XMLHttpRequest = original;
  });

  const install = (filters: ProfileFilters, owns = true) => {
    const takeover = statTakeover(
      () => filters,
      () => owns,
    );
    installProfileFilterHook(
      [...takeover.rules],
      () => false,
      takeover.rewriteBody,
      takeover.disableSavedStats,
    );
  };
  const request = (method: string, url: string, body?: string, response?: string): Fake => {
    const xhr = new window.XMLHttpRequest() as Fake;
    xhr.open(method, url);
    if (response !== undefined) {
      xhr.__setRawResponse(response);
    }
    xhr.send(body);
    return xhr;
  };
  const owned = parseProfileFilters({
    unlisted: { endowment: true },
    picks: { endowment: { min: 20, max: 30, cut: "cut" } },
  });

  it.each([
    ["post-authentication", "/api/post-authentication?timeThreshold=1"],
    ["softReload", "/api/softReload"],
    ["advanced search", "/api/advanced-filter/search"],
  ])("strips the endowment pick from the %s request body", (_name, path) => {
    install(owned);
    request(
      "POST",
      `${API}${path}`,
      filtersBody({ "stats.endowment": { min: 20, max: 30, cut: "cut" } }),
    );
    expect(JSON.parse(sent[0] as string).filters).toEqual({ BASIC_FILTERS: {} });
  });

  it("keeps Sniffies' own stats in the request", () => {
    install(owned);
    request(
      "POST",
      `${API}/api/softReload`,
      filtersBody({ "stats.age": { min: 18, max: 29 }, "stats.endowment": { min: 20 } }),
    );
    expect(JSON.parse(sent[0] as string).filters.CRUISER_STATS.value).toEqual({
      "stats.age": { min: 18, max: 29 },
    });
  });

  it("leaves the request alone when the profile filters are off", () => {
    install(owned, false);
    const body = filtersBody({ "stats.endowment": { min: 20, max: 30 } });
    request("POST", `${API}/api/post-authentication`, body);
    expect(sent[0]).toBe(body);
  });

  it("loads our stats as off in the saved filters Sniffies restores on login", () => {
    install(owned);
    const saved = JSON.stringify({
      user: {
        private: {
          options: {
            filters: {
              USERS: [
                {
                  filterType: "CRUISER_STATS",
                  value: { "stats.endowment": { min: 20, max: 30, cut: "cut" } },
                  enabledValues: { "stats.endowment": true, "stats.age": true },
                  enabled: true,
                },
              ],
            },
          },
        },
      },
    });
    const xhr = request("POST", `${API}/api/authenticate/current`, "{}", saved);
    const [entry] = JSON.parse(xhr.responseText).user.private.options.filters.USERS;
    expect(entry.enabledValues).toEqual({ "stats.endowment": false, "stats.age": true });
    // And what it had saved is kept, to start our row from.
    expect(JSON.parse(localStorage.getItem("snp-native-stat-picks")!)).toEqual({
      endowment: { min: 20, max: 30, cut: "cut" },
    });
  });

  it("passes the saved filters through untouched when the profile filters are off", () => {
    install(owned, false);
    const saved = JSON.stringify({
      user: {
        private: {
          options: {
            filters: {
              USERS: [{ filterType: "CRUISER_STATS", enabledValues: { "stats.endowment": true } }],
            },
          },
        },
      },
    });
    const xhr = request("POST", `${API}/api/authenticate/current`, "{}", saved);
    expect(JSON.parse(xhr.responseText)).toEqual(JSON.parse(saved));
  });

  describe("a profile with no endowment listed, in the map response", () => {
    const map = JSON.stringify({
      nearbyVisitors: {
        visitors: [
          {
            _id: "match",
            data: {
              profile: { extended: { stats: { endowment: { lengthInCm: 25, isCut: true } } } },
            },
          },
          {
            _id: "none",
            data: {
              profile: { extended: { stats: { endowment: { lengthInCm: null, isCut: null } } } },
            },
          },
        ],
      },
    });
    const ids = (xhr: Fake): string[] =>
      JSON.parse(xhr.responseText).nearbyVisitors.visitors.map((v: { _id: string }) => v._id);
    const withUnlisted = (unlisted: boolean) =>
      parseProfileFilters({
        unlisted: { endowment: unlisted },
        picks: { endowment: { min: 20, max: 30, cut: "cut" } },
      });

    it("stays when none listed is on", () => {
      install(withUnlisted(true));
      expect(ids(request("POST", `${API}/api/post-authentication`, "{}", map))).toEqual([
        "match",
        "none",
      ]);
    });

    it("is hidden when none listed is off", () => {
      install(withUnlisted(false));
      expect(ids(request("POST", `${API}/api/post-authentication`, "{}", map))).toEqual(["match"]);
    });
  });
});
