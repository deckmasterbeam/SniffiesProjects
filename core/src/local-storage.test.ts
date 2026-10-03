import { afterEach, describe, expect, it } from "vitest";
import {
  getProfileBorderOpen,
  getProfileBorderSectionOpen,
  setProfileBorderOpen,
  setProfileBorderSectionOpen,
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

describe("profile border section open", () => {
  it("defaults to false", () => {
    expect(getProfileBorderSectionOpen()).toBe(false);
  });

  it("round-trips true", () => {
    setProfileBorderSectionOpen(true);
    expect(getProfileBorderSectionOpen()).toBe(true);
  });
});
