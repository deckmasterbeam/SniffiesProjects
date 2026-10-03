import { afterEach, describe, expect, it } from "vitest";
import { mountFab } from "./mount-fab.js";

const makeIconHolder = (): HTMLElement => {
  const holder = document.createElement("div");
  holder.dataset.testid = "iconHolderRightBottom";
  holder.setAttribute("_ngcontent-abc", "");
  holder.appendChild(document.createElement("button"));
  return holder;
};

describe("mountFab", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("docks the fab at the front of the map icon row", () => {
    const holder = makeIconHolder();
    document.body.appendChild(holder);
    const fab = document.createElement("button");

    mountFab(fab);

    expect(holder.firstElementChild).toBe(fab);
    expect(fab.classList.contains("snp-fab-docked")).toBe(true);
    expect(fab.hasAttribute("_ngcontent-abc")).toBe(true);
  });

  it("falls back to body, then docks once the icon row appears", async () => {
    const fab = document.createElement("button");
    mountFab(fab);
    expect(fab.parentElement).toBe(document.body);

    const holder = makeIconHolder();
    document.body.appendChild(holder);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fab.parentElement).toBe(holder);
  });
});
