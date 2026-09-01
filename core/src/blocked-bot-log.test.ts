import { describe, expect, it } from "vitest";
import { countDistinctBlockedBotsLast24h, recordBlockedBotIds } from "./blocked-bot-log.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOON_JAN_2 = new Date("2026-01-02T12:00:00.000Z");

describe("recordBlockedBotIds", () => {
  it("adds new ids to today's bucket", () => {
    const next = recordBlockedBotIds({}, ["a", "b"], NOON_JAN_2);
    expect(next).toEqual({ "2026-01-02": ["a", "b"] });
  });

  it("dedupes ids already recorded today", () => {
    const next = recordBlockedBotIds({ "2026-01-02": ["a"] }, ["a", "b"], NOON_JAN_2);
    expect(next["2026-01-02"]).toEqual(["a", "b"]);
  });

  it("keeps yesterday's bucket untouched alongside today's", () => {
    const yesterday = new Date(NOON_JAN_2.getTime() - DAY_MS);
    const log = { [yesterday.toISOString().slice(0, 10)]: ["y1"] };
    const next = recordBlockedBotIds(log, ["a"], NOON_JAN_2);
    expect(next).toEqual({
      "2026-01-01": ["y1"],
      "2026-01-02": ["a"],
    });
  });

  it("drops buckets older than yesterday", () => {
    const log = { "2025-12-01": ["old"], "2026-01-01": ["y1"] };
    const next = recordBlockedBotIds(log, ["a"], NOON_JAN_2);
    expect(next).toEqual({ "2026-01-01": ["y1"], "2026-01-02": ["a"] });
  });

  it("is a no-op for an empty ids list", () => {
    const log = { "2026-01-01": ["y1"] };
    expect(recordBlockedBotIds(log, [], NOON_JAN_2)).toBe(log);
  });
});

describe("countDistinctBlockedBotsLast24h", () => {
  it("unions today's and yesterday's distinct ids", () => {
    const log = { "2026-01-01": ["a", "b"], "2026-01-02": ["b", "c"] };
    expect(countDistinctBlockedBotsLast24h(log, NOON_JAN_2)).toBe(3);
  });

  it("ignores buckets older than yesterday", () => {
    const log = { "2025-12-01": ["old1", "old2"], "2026-01-02": ["a"] };
    expect(countDistinctBlockedBotsLast24h(log, NOON_JAN_2)).toBe(1);
  });

  it("returns 0 for an empty log", () => {
    expect(countDistinctBlockedBotsLast24h({}, NOON_JAN_2)).toBe(0);
  });
});
