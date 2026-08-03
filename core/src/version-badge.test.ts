import { afterEach, beforeEach, describe, expect, it } from "vitest";
import VERSION_BADGE_HTML from "./version-badge.html";
import { wireVersionBadge } from "./version-badge.js";

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = VERSION_BADGE_HTML;
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

describe("wireVersionBadge", () => {
  it("renders the version prefixed with 'v'", () => {
    wireVersionBadge(container, "1.2.3");
    expect(container.querySelector("#snp-version")!.textContent).toBe("v1.2.3");
  });

  it("does nothing when the container has no #snp-version element", () => {
    const empty = document.createElement("div");
    expect(() => wireVersionBadge(empty, "1.2.3")).not.toThrow();
  });
});
