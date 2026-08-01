import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("inserts fab as sibling after [title=Sitelinks] and calls onMounted when already present", () => {
    const sitelinks = document.createElement("div");
    sitelinks.title = "Sitelinks";
    nav.appendChild(sitelinks);

    const fab = makeFab();
    const onMounted = vi.fn();
    mountFab(fab, onMounted);

    expect(fab.parentElement).toBe(nav);
    expect(sitelinks.nextSibling).toBe(fab);
    expect(onMounted).toHaveBeenCalledOnce();
  });

  it("does not mount or call onMounted when [title=Sitelinks] isn't in the DOM yet", () => {
    const fab = makeFab();
    const onMounted = vi.fn();
    mountFab(fab, onMounted);

    expect(document.body.contains(fab)).toBe(false);
    expect(onMounted).not.toHaveBeenCalled();
  });

  it("mounts and calls onMounted once [title=Sitelinks] appears later", async () => {
    const fab = makeFab();
    const onMounted = vi.fn();
    mountFab(fab, onMounted);

    const sitelinks = document.createElement("div");
    sitelinks.title = "Sitelinks";
    nav.appendChild(sitelinks);

    // MutationObserver callbacks run as microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(fab.parentElement).toBe(nav);
    expect(onMounted).toHaveBeenCalledOnce();
  });

  it("does not mount when [title=Sitelinks] has no parentElement", () => {
    // Detached element — has the attribute but no parent in the document
    const detached = document.createElement("div");
    detached.title = "Sitelinks";

    const fab = makeFab();
    const onMounted = vi.fn();
    mountFab(fab, onMounted);

    expect(document.body.contains(fab)).toBe(false);
    expect(onMounted).not.toHaveBeenCalled();
  });
});
