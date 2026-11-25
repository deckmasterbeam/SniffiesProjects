import { preferredUnits, saveUnits, unitsFromAccount } from "@core/profile-filter/units.js";
import { afterEach, describe, expect, it } from "vitest";

const account = (options: unknown, countryCode?: string): unknown => ({
  user: { private: { options }, data: { profile: { countryCode } } },
});

describe("units", () => {
  afterEach(() => localStorage.clear());

  it("takes the account's own setting first", () => {
    expect(unitsFromAccount(account({ units: "metric" }, "US"))).toBe("metric");
    expect(unitsFromAccount(account({ units: "imperial" }, "DE"))).toBe("imperial");
  });

  it("falls back to the account's country the way Sniffies does", () => {
    expect(unitsFromAccount(account({}, "US"))).toBe("imperial");
    expect(unitsFromAccount(account({}, "LR"))).toBe("imperial");
    expect(unitsFromAccount(account({}, "MM"))).toBe("imperial");
    expect(unitsFromAccount(account({}, "GB"))).toBe("metric");
  });

  it("ignores a setting it doesn't know, and a payload with nothing to go on", () => {
    expect(unitsFromAccount(account({ units: "furlongs" }, "GB"))).toBe("metric");
    expect(unitsFromAccount(account({}))).toBeNull();
    expect(unitsFromAccount(null)).toBeNull();
  });

  it("remembers the account's units, else follows the browser's region (en-US here)", () => {
    expect(preferredUnits()).toBe("imperial");
    saveUnits("metric");
    expect(preferredUnits()).toBe("metric");
  });
});
