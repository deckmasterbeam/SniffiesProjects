import type { Page } from "@playwright/test";
import { SNIFFIES_ORIGIN } from "./constants.js";
import { sendXhr, type ApiResponses } from "./sniffies-api.js";

/**
 * Shared by the extension and userscript specs: the Gender / Height / Weight / Last Online filters
 * hide profiles in everything Sniffies sends to the page (the map init, an Apply result from the
 * filter menu, and live frames), so each case is checked against all three.
 */

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

interface Fields {
  gender?: "man" | "woman";
  heightInCm?: number;
  weightInKg?: number;
  seen: string;
}

const profile = (id: string, { gender, heightInCm, weightInKg, seen }: Fields) => ({
  _id: id,
  data: {
    connectUpdateTime: seen,
    profile: {
      extended: {
        sexuality: { gender: gender ?? null },
        stats: { heightInCm: heightInCm ?? null, weightInKg: weightInKg ?? null },
      },
    },
  },
});

/** Built fresh for each test, since Last Online is relative to when the page loads. */
export const profiles = () => [
  profile("man180", { gender: "man", heightInCm: 180, weightInKg: 80, seen: minutesAgo(1) }),
  profile("woman160", { gender: "woman", heightInCm: 160, weightInKg: 60, seen: minutesAgo(1) }),
  // Lists nothing at all.
  profile("blank", { seen: minutesAgo(1) }),
  profile("tall200", { gender: "man", heightInCm: 200, weightInKg: 100, seen: minutesAgo(1) }),
  // As man180, but last seen three hours ago.
  profile("stale", { gender: "man", heightInCm: 180, weightInKg: 80, seen: minutesAgo(180) }),
];

export const RESPONSE_PATHS = {
  map: "/api/post-authentication",
  search: "/api/advanced-filter/search",
} as const;

export const responses = (): ApiResponses => ({
  [RESPONSE_PATHS.map]: {
    nearbyVisitors: { visitors: profiles(), emitRadiusInMiles: 1 },
    partialVisitorData: [],
  },
  [RESPONSE_PATHS.search]: { result: { nearbyUsers: profiles() } },
});

export interface Case {
  name: string;
  filters: Record<string, unknown>;
  /** The ids that stay, in the order the server sent them. */
  keeps: string[];
}

const ALL = ["man180", "woman160", "blank", "tall200", "stale"];
const range = (min: number, max: number, includeUnspecified = false) => ({
  enabled: true,
  min,
  max,
  includeUnspecified,
});

export const CASES: Case[] = [
  { name: "no filter is on", filters: {}, keeps: ALL },
  {
    name: "Gender: men only",
    filters: { gender: { enabled: true, genders: ["man"] } },
    keeps: ["man180", "tall200", "stale"],
  },
  {
    name: "Gender: men and not specified",
    filters: { gender: { enabled: true, genders: ["man", "undefined"] } },
    keeps: ["man180", "blank", "tall200", "stale"],
  },
  {
    name: "Height: 170–190 cm",
    filters: { height: range(170, 190) },
    keeps: ["man180", "stale"],
  },
  {
    name: "Height: 170–190 cm, with none listed",
    filters: { height: range(170, 190, true) },
    keeps: ["man180", "blank", "stale"],
  },
  {
    name: "Weight: 70–90 kg",
    filters: { weight: range(70, 90) },
    keeps: ["man180", "stale"],
  },
  {
    name: "Last online: within an hour",
    filters: { online: { enabled: true, minutes: 60 } },
    keeps: ["man180", "woman160", "blank", "tall200"],
  },
];

const ids = (list: { _id: string }[]): string[] => list.map((item) => item._id);

/** The ids the page gets back from the map init. */
export const mapIds = async (page: Page): Promise<string[]> => {
  const body = JSON.parse(
    await sendXhr(page, "POST", `${SNIFFIES_ORIGIN}${RESPONSE_PATHS.map}`, {}),
  );
  return ids(body.nearbyVisitors.visitors);
};

/** The ids the page gets back from an Apply in the filter menu. */
export const searchIds = async (page: Page): Promise<string[]> => {
  const body = JSON.parse(
    await sendXhr(page, "POST", `${SNIFFIES_ORIGIN}${RESPONSE_PATHS.search}`, {}),
  );
  return ids(body.result.nearbyUsers);
};

/** `userJoined` frames, one per profile, in the order `profiles()` lists them. */
export const joinedFrames = () =>
  profiles().map((profileData) => ({ eventName: "userJoined", data: profileData }));
