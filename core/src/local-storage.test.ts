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
  it("defaults to on, and a saved value round-trips", () => {
    expect(getPremiumFeaturesEnabled()).toBe(true);
    setPremiumFeaturesEnabled(false);
    expect(getPremiumFeaturesEnabled()).toBe(false);
  });

  it("is not affected by saving the border setting", () => {
    setProfileBorderOpen({ enabled: false, openInNewTab: false });
    expect(getPremiumFeaturesEnabled()).toBe(true);
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
