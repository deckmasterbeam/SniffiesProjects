import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountFab } from "./mount-fab.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeFab = (): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.id = "snp-fab";
  return btn;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("mountFab", () => {
  let nav: HTMLElement;

  beforeEach(() => {
    nav = document.createElement("div");
    document.body.appendChild(nav);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("inserts fab as sibling after [title=Sitelinks] when nav is present", () => {
    const sitelinks = document.createElement("div");
    sitelinks.title = "Sitelinks";
    nav.appendChild(sitelinks);

    const fab = makeFab();
    mountFab(fab);

    expect(fab.parentElement).toBe(nav);
    expect(sitelinks.nextSibling).toBe(fab);
  });

  it("fab is not appended to body when nav is present", () => {
    const sitelinks = document.createElement("div");
    sitelinks.title = "Sitelinks";
    nav.appendChild(sitelinks);

    mountFab(makeFab());

    expect(document.body.lastElementChild?.id).not.toBe("snp-fab");
  });

  it("falls back to appending to body when nav is not found", () => {
    const fab = makeFab();
    mountFab(fab);
    expect(document.body.contains(fab)).toBe(true);
  });

  it("falls back to body when [title=Sitelinks] has no parentElement", () => {
    // Detached element — has the attribute but no parent in the document
    const detached = document.createElement("div");
    detached.title = "Sitelinks";

    const fab = makeFab();
    mountFab(fab);
    expect(document.body.contains(fab)).toBe(true);
  });
});
