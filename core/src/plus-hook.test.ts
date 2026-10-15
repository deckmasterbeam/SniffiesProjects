import { describe, expect, it } from "vitest";
import { isPlusMembership } from "./plus-hook.js";

const now = Date.parse("2026-01-01T00:00:00Z");
const member = (m: object | null | undefined) => ({ user: { private: { appstoreMembership: m } } });

describe("isPlusMembership", () => {
  it.each([
    [
      "active, ends later",
      member({ name: "Plus", subscriptionStatus: "active", end: "2026-02-01T00:00:00Z" }),
      true,
    ],
    ["active, no end", member({ subscriptionStatus: "active" }), true],
    [
      "active but ended",
      member({ subscriptionStatus: "active", end: "2025-12-01T00:00:00Z" }),
      false,
    ],
    ["cancelled", member({ subscriptionStatus: "expired", end: "2026-02-01T00:00:00Z" }), false],
    ["null membership", member(null), false],
    ["no membership field", member(undefined), false],
    ["no user", {}, false],
  ])("%s", (_name, body, expected) => {
    expect(isPlusMembership(body, now)).toBe(expected);
  });
});
