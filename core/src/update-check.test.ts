import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLatestVersion, isNewerVersion, isUpdateAvailable } from "./update-check.js";

describe("isNewerVersion", () => {
  it("returns true when b has a higher minor version", () => {
    expect(isNewerVersion("0.2", "0.3")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isNewerVersion("1.2", "1.2")).toBe(false);
  });

  it("returns false when b is older", () => {
    expect(isNewerVersion("1.2", "1.1")).toBe(false);
  });

  it("compares numerically, not lexicographically", () => {
    expect(isNewerVersion("1.9", "1.10")).toBe(true);
  });

  it("treats missing trailing segments as zero", () => {
    expect(isNewerVersion("1.0", "1.0.1")).toBe(true);
    expect(isNewerVersion("1.0.0", "1.0")).toBe(false);
  });
});

const releasesResponse = (tags: string[]) => ({
  ok: true,
  json: async () => tags.map((tag_name) => ({ tag_name })),
});

describe("fetchLatestVersion", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the newest version for the given channel prefix", async () => {
    fetchMock.mockResolvedValue(
      releasesResponse(["chrome-0.3", "chrome-0.2", "userscript-0.5", "chrome-0.1"]),
    );
    await expect(fetchLatestVersion("chrome")).resolves.toBe("0.3");
  });

  it("ignores releases from other channels", async () => {
    fetchMock.mockResolvedValue(releasesResponse(["userscript-0.5"]));
    await expect(fetchLatestVersion("chrome")).resolves.toBeNull();
  });

  it("returns null when the request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchLatestVersion("chrome")).resolves.toBeNull();
  });

  it("swallows network errors", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(fetchLatestVersion("chrome")).resolves.toBeNull();
  });
});

describe("isUpdateAvailable", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the published version is newer", async () => {
    fetchMock.mockResolvedValue(releasesResponse(["chrome-0.3"]));
    await expect(isUpdateAvailable("chrome", "0.2")).resolves.toBe(true);
  });

  it("returns false when already current", async () => {
    fetchMock.mockResolvedValue(releasesResponse(["chrome-0.2"]));
    await expect(isUpdateAvailable("chrome", "0.2")).resolves.toBe(false);
  });

  it("returns false when no release is found", async () => {
    fetchMock.mockResolvedValue(releasesResponse([]));
    await expect(isUpdateAvailable("chrome", "0.2")).resolves.toBe(false);
  });
});
