import { afterEach, describe, expect, it } from "vitest";
import {
  getBlockedBotEventsByDay,
  getBlockedBots,
  getBlockedBotsFetchedAt,
  getBotBlockingEnabled,
  getBotBlockingSectionOpen,
  recordBlockedBotEvent,
  setBlockedBots,
  setBotBlockingEnabled,
  setBotBlockingSectionOpen,
} from "./settings.js";

afterEach(() => {
  localStorage.clear();
});

describe("blocked bots", () => {
  it("defaults to an empty list and a zero fetchedAt", () => {
    expect(getBlockedBots()).toEqual([]);
    expect(getBlockedBotsFetchedAt()).toBe(0);
  });

  it("round-trips the ids and fetchedAt", () => {
    setBlockedBots(["abc123", "def456"], 1700000000000);
    expect(getBlockedBots()).toEqual(["abc123", "def456"]);
    expect(getBlockedBotsFetchedAt()).toBe(1700000000000);
  });

  it("falls back to an empty list for corrupted storage", () => {
    localStorage.setItem("sniffies-blocked-bots", "not json");
    expect(getBlockedBots()).toEqual([]);
  });
});

describe("bot blocking enabled", () => {
  it("defaults to true when unset", () => {
    expect(getBotBlockingEnabled()).toBe(true);
  });

  it("round-trips false", () => {
    setBotBlockingEnabled(false);
    expect(getBotBlockingEnabled()).toBe(false);
  });

  it("round-trips true after being set false", () => {
    setBotBlockingEnabled(false);
    setBotBlockingEnabled(true);
    expect(getBotBlockingEnabled()).toBe(true);
  });
});

describe("bot blocking section open", () => {
  it("defaults to false", () => {
    expect(getBotBlockingSectionOpen()).toBe(false);
  });

  it("round-trips true", () => {
    setBotBlockingSectionOpen(true);
    expect(getBotBlockingSectionOpen()).toBe(true);
  });
});

describe("blocked bot events", () => {
  it("defaults to an empty log", () => {
    expect(getBlockedBotEventsByDay()).toEqual({});
  });

  it("merges recorded ids into today's bucket", () => {
    recordBlockedBotEvent(["abc123"]);
    recordBlockedBotEvent(["def456", "abc123"]);
    const log = getBlockedBotEventsByDay();
    const today = Object.keys(log)[0]!;
    expect(log[today]?.sort()).toEqual(["abc123", "def456"]);
  });
});
