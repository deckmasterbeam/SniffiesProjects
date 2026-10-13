// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { installHidePhotoMenuButtons } from "./hide-photo-menu-hook.js";

const FREE_MENU = `
  <div data-testid="profileOptionsContainer">
    <button data-testid="blockButton"><span><i class="fa fa-ban"></i>Block</span></button>
  </div>`;
const PAID_MENU = `
  <div data-testid="profileOptionsContainer">
    <button data-testid="hideAllPhotosButton"><span><i class="fa fa-eye-slash"></i>Hide All My Photos</span></button>
    <button data-testid="unhideAllPhotosButton"><span><i class="fa fa-eye"></i>Unhide All My Photos</span></button>
  </div>`;

let uninstall: (() => void) | null = null;
let enabled = true;

const openMenu = async (html: string): Promise<Element> => {
  uninstall = installHidePhotoMenuButtons(() => enabled);
  document.body.innerHTML = html;
  await Promise.resolve(); // let the MutationObserver run
  return document.querySelector('[data-testid="profileOptionsContainer"]')!;
};

afterEach(() => {
  uninstall?.();
  enabled = true;
  document.body.innerHTML = "";
});

describe("installHidePhotoMenuButtons", () => {
  it("adds Hide All and Unhide All to a menu that lacks them", async () => {
    const menu = await openMenu(FREE_MENU);

    const hide = menu.querySelector('[data-testid="hideAllPhotosButton"]')!;
    const unhide = menu.querySelector('[data-testid="unhideAllPhotosButton"]')!;
    expect(hide.textContent).toBe("Hide All My Photos");
    expect(hide.querySelector("i")!.className).toContain("fa-eye-slash");
    expect(unhide.textContent).toBe("Unhide All My Photos");
    expect(unhide.querySelector("i")!.className).toContain("fa-eye");
    expect(menu.querySelector("[data-testid=blockButton]")!.textContent).toBe("Block");
  });

  it("leaves a menu that already has Sniffies' own buttons alone", async () => {
    const menu = await openMenu(PAID_MENU);
    expect(menu.querySelectorAll("button")).toHaveLength(2);
  });

  it("adds nothing while disabled", async () => {
    enabled = false;
    const menu = await openMenu(FREE_MENU);
    expect(menu.querySelectorAll("button")).toHaveLength(1);
  });
});
