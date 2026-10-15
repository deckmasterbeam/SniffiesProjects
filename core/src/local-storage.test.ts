import { afterEach, describe, expect, it } from "vitest";
import {
  getPremiumFeatureFlags,
  setPremiumFeatureFlags,
  getPremiumFeaturesEnabled,
  setPremiumFeaturesEnabled,
  getProfileBorderOpen,
  setProfileBorderOpen,
} from "./local-storage.js";
import { DEFAULT_PROFILE_BORDER_OPEN } from "./settings.js";

afterEach(() => {
  localStorage.clear();
});

describe("profile border open", () => {
  it("defaults when unset or corrupted", () => {
    expect(getProfileBorderOpen()).toEqual(DEFAULT_PROFILE_BORDER_OPEN);
    localStorage.setItem("sniffies-profile-border", "not json");
    expect(getProfileBorderOpen()).toEqual(DEFAULT_PROFILE_BORDER_OPEN);
  });

  it("round-trips", () => {
    setProfileBorderOpen({ enabled: true, openInNewTab: false });
    expect(getProfileBorderOpen()).toEqual({ enabled: true, openInNewTab: false });
  });
});

describe("premium features enabled", () => {
  const legacy = (geo?: boolean, border?: boolean) => {
    if (geo !== undefined) {
      localStorage.setItem("sniffies-geo", JSON.stringify({ enabled: geo }));
    }
    if (border !== undefined) {
      localStorage.setItem("sniffies-profile-border", JSON.stringify({ enabled: border }));
    }
  };

  it.each([
    [undefined, undefined, true], // fresh install
    [true, false, true],
    [false, true, true],
    [true, true, true],
    [false, false, false], // existing user who turned both off stays off
    [false, undefined, false],
  ])("migrates legacy geo=%s border=%s -> %s", (geo, border, expected) => {
    legacy(geo, border);
    expect(getPremiumFeaturesEnabled()).toBe(expected);
  });

  it("a saved value wins over legacy and round-trips", () => {
    legacy(true, true);
    setPremiumFeaturesEnabled(false);
    expect(getPremiumFeaturesEnabled()).toBe(false);
  });
});

describe("premium feature flags", () => {
  it("defaults every feature to on", () => {
    expect(getPremiumFeatureFlags()).toEqual({ location: true, boundary: true, photos: true });
  });

  it("round-trips and fills in missing keys", () => {
    setPremiumFeatureFlags({ location: false, boundary: true, photos: false });
    expect(getPremiumFeatureFlags()).toEqual({ location: false, boundary: true, photos: false });
    localStorage.setItem("sniffies-premium-feature-flags", '{"photos":false}');
    expect(getPremiumFeatureFlags()).toEqual({ location: true, boundary: true, photos: false });
  });
});
