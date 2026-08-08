import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UPDATE_BANNER_HTML from "./update-banner.html";
import { wireUpdateBanner } from "./update-banner.js";

let container: HTMLElement;
let fetchMock: ReturnType<typeof vi.fn>;

const releasesResponse = (tags: string[]) => ({
  ok: true,
  json: async () => tags.map((tag_name) => ({ tag_name })),
});

beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = UPDATE_BANNER_HTML;
  document.body.appendChild(container);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  document.body.removeChild(container);
  vi.unstubAllGlobals();
});

describe("wireUpdateBanner", () => {
  it("un-hides the banner when a newer release is published", async () => {
    fetchMock.mockResolvedValue(releasesResponse(["chrome-0.3"]));
    wireUpdateBanner(container, "chrome", "0.2");
    await vi.waitFor(() => {
      expect(container.querySelector<HTMLElement>("#snp-update-banner")!.hidden).toBe(false);
    });
  });

  it("keeps the banner hidden when already current", async () => {
    fetchMock.mockResolvedValue(releasesResponse(["chrome-0.2"]));
    wireUpdateBanner(container, "chrome", "0.2");
    await Promise.resolve();
    await Promise.resolve();
    expect(container.querySelector<HTMLElement>("#snp-update-banner")!.hidden).toBe(true);
  });

  it("does nothing when the container has no #snp-update-banner element", () => {
    const empty = document.createElement("div");
    expect(() => wireUpdateBanner(empty, "chrome", "0.2")).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
